// // MongoDB Connection Configuration
// const mongoose = require('mongoose');

// const MONGODB_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017/temple_steward';

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(MONGODB_URI);

//     console.log(`MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error('MongoDB connection error:', error.message);
//     process.exit(1);
//   }
// };

// // Handle connection events
// mongoose.connection.on('connected', () => {
//   console.log('Mongoose connected to MongoDB');
// });

// mongoose.connection.on('error', (err) => {
//   console.error('Mongoose connection error:', err);
// });

// mongoose.connection.on('disconnected', () => {
//   console.log('Mongoose disconnected');
// });

// module.exports = connectDB;
