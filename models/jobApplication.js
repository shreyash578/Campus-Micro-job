const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job ID is required'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Selected', 'Rejected'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

jobApplicationSchema.index({ studentId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
