const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const error = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data: ${error.join('. ')}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsErrorDB = (err) => {
  const message = `Duplicate field: ${err.keyValue.name}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invaid token. Please login again.', 401);

const handleJWTExpiredError = () =>
  new AppError('Expired token. Please login again.', 401);

const sendErrorDev = (err, req, res) => {
  // a) FOR THE API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  // b) FOR THE RENDERED WEBSITE
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong.',
    msg: err.message,
  });
};

const sendErrorProd = (err, req, res) => {
  // a) FOR THE API
  if (req.originalUrl.startsWith('/api')) {
    // Operational error we trust: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // Programming or other unknown error: don't leak error details
    // 1. Log error
    console.log('ERROR 😔', err);

    // 2. Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong',
    });
  }

  // b) FOR THE RENDERED WEBSITE
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong.',
      msg: err.message,
    });
  }
  // Programming or other unknown error: don't leak error details
  // 1. Log error
  console.log('ERROR 😔', err);

  // 2. Send generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong.',
    msg: 'Please try again later.',
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') sendErrorDev(err, req, res);
  else if (process.env.NODE_ENV === 'production') {
    let error = Object.create(err);

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.code === 11000) error = handleDuplicateFieldsErrorDB(error);

    sendErrorProd(error, req, res);
  }

  next();
};
