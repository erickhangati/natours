const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const getToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, req, res) => {
  const token = getToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (req.secure || req.headers['x-forward-proto'] === 'https')
    cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signUp = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    changedPasswordAt: req.body.changedPasswordAt,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and passwords exits
  if (!email || !password)
    return next(new AppError(`Please provide email and password`, 400));

  // 2) Check if username exists and if password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password)))
    return next(new AppError(`Incorrect email or password`, 401));

  // 3) If everything is ok send token to client
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token and check if its there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ').at(1);
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token)
    return next(
      new AppError('You are not logged in. Please log in to get access', 401)
    );

  // 2) Verify the token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exist
  const checkedUser = await User.findOne({ _id: decoded.id });

  if (!checkedUser)
    return next(new AppError('User of that token no longer exists.', 401));

  // 4) Check if user changed password after the token was issued
  if (checkedUser.changedPasswordAfter(decoded.iat))
    return next(
      new AppError('Password was changed recently. Please login again.', 401)
    );

  req.user = checkedUser;
  res.locals.user = checkedUser;

  next();
});

// Only for rendered pages and there will be no errors
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verifies the token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exist
      const checkedUser = await User.findOne({ _id: decoded.id });
      if (!checkedUser) return next();

      // 3) Check if user changed password after the token was issued
      if (checkedUser.changedPasswordAfter(decoded.iat)) return next();

      // There is a logged in user
      res.locals.user = checkedUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = function (...roles) {
  return function (req, res, next) {
    if (!roles.includes(req.user.role))
      return next(
        new AppError('You are not allowed to access this resource.', 403)
      );

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on posted email
  const user = await User.findOne({ email: req.body.email });

  if (!user)
    return next(
      new AppError(`User not found with email ${req.body.email}.`, 404)
    );

  // 2) Generate random reset token
  const resetToken = user.createdPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    // 3) Send it back to user email
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/reset-password/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email.',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending email. Please try again later.',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError('Token is invalid or expired.', 400));

  // 2) If token is not expired and there is a user, set the new password,
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // 3) Update changedPasswordAt property (done in the pre-save middleware)

  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from the collection
  const user = await User.findById(req.user.id).select('+password');

  if (!user) return next(new AppError('This user does not exist.', 404));

  // 2) Check posted password is correct
  const checkedPassword = await user.correctPassword(
    req.body.oldPassword,
    user.password
  );

  if (!checkedPassword)
    return next(
      new AppError('Entered the wrong password. Please try again.', 400)
    );

  // 3) Update password
  user.password = req.body.newPassword;
  user.confirmPassword = req.body.confirmNewPassword;
  await user.save();

  // 4) Log in user and send JWT
  createSendToken(user, 200, req, res);
});
