const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['student', 'company', 'admin'],
      default: 'student',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
