const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');

// Start express app
const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES

// --- Serving Static Files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

// --- Set Security HTTP Headers

app.use(helmet());

// --- Development Logging
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// --- Rate Limiter
const limiter = rateLimit({
  max: 100,
  windowM: 60 * 60 * 1000,
  message: 'Too many request from this IP. Please try again in an hour!',
});

app.use('/api', limiter);

// --- Request Body Parser
app.use(express.json({ limit: '10kb' }));

// --- Form Body Parser
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Cookie Parser
app.use(cookieParser());

// --- Data sanitization against NoSQL injection
app.use(mongoSanitize());

// --- Data sanitization against XSS
app.use(xss());

// --- Prevent Parameter Pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingAverage',
      'ratingQuantity',
      'maxGroupSize',
      'price',
      'difficulty',
    ],
  })
);

// --- Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 2) ROUTE HANDLERS

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Cant find ${req.originalUrl} on this server.`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
