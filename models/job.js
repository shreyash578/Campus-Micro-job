const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    stipend: {
      type: Number,
      required: [true, 'Stipend is required'],
      min: [0, 'Stipend cannot be negative'],
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Posting company is required'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Job', jobSchema);
