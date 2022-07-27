const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');

exports.getOverview = catchAsync(async (req, res, next) => {
  const tours = await Tour.find();

  if (!tours) return next(new AppError('Something went wrong.', 500));

  res.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    select: 'review user rating',
  });

  if (!tour) return next(new AppError('Tour not found.', 404));

  res.set(
    'Content-Security-Policy',
    "default-src 'self' https://*.mapbox.com https://*.stripe.com ;base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src https://cdnjs.cloudflare.com https://api.mapbox.com https://js.stripe.com/v3/ 'self' blob: ;script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests;"
  );

  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});

exports.getLoginForm = (req, res) => {
  res.set(
    'Content-Security-Policy',
    "connect-src 'self' http://127.0.0.1:8000/"
  );

  res.status(200).render('login', {
    title: 'Login',
  });
};

exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Account Page',
  });
};

exports.getMyTours = catchAsync(async (req, res, next) => {
  // 1. Get bookings by user
  const bookings = await Booking.find({ user: req.user.id });

  // 2. Get tours using the bookings
  const tourIds = bookings.map((el) => el.tour.id);
  const tours = await Tour.find({ _id: { $in: tourIds } });

  if (!tours) return next(new AppError('Something went wrong.', 500));

  // 3. Render bookings
  res.status(200).render('overview', {
    title: 'My Bookings',
    tours,
  });
});

exports.updateAccount = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedUser) return next(new AppError('User could not be found.', 404));

  res.status(200).render('account', {
    title: 'Account Page',
    user: updatedUser,
  });
});
