const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    campus: {
      type: String,
      required: [true, 'Campus is required'],
      trim: true,
      maxlength: [120, 'Campus cannot exceed 120 characters'],
    },
    preferredDomains: {
      type: [String],
      default: [],
      set: (values) => {
        if (!Array.isArray(values)) return [];
        return values
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
          .slice(0, 10);
      },
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      match: [/^\+?[0-9\-\s]{7,15}$/, 'Please provide a valid contact number'],
    },
    resumeLink: {
      type: String,
      required: [true, 'Resume link is required'],
      trim: true,
      match: [/^https?:\/\/[^\s$.?#].[^\s]*$/, 'Please provide a valid URL'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Student', studentSchema);
