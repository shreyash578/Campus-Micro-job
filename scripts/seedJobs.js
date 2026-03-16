require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/job');
const Company = require('../models/company');

async function seedJobs() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_microjob';
  await mongoose.connect(uri);

  let company = await Company.findOne({ email: 'seed@campus.local' });
  if (!company) {
    company = await Company.create({
      companyName: 'Campus Seed Company',
      email: 'seed@campus.local',
      password: 'seedpass123',
      description: 'Seed company for sample jobs.',
    });
  }
  const postedBy = company._id;
  const now = Date.now();
  const jobs = [
    {
      title: 'Web Development Intern',
      description: 'Build and maintain student portal modules and API integrations.',
      stipend: 7000,
      deadline: new Date(now + 10 * 24 * 60 * 60 * 1000),
      domain: 'Web Development',
      campus: 'Main Campus',
      postedBy,
    },
    {
      title: 'Data Analyst Intern',
      description: 'Analyze placement data and create campus hiring insights dashboard.',
      stipend: 6500,
      deadline: new Date(now + 12 * 24 * 60 * 60 * 1000),
      domain: 'Data Science',
      campus: 'Main Campus',
      postedBy,
    },
    {
      title: 'AI Research Assistant',
      description: 'Work on student recommendation experiments and NLP use cases.',
      stipend: 8000,
      deadline: new Date(now + 15 * 24 * 60 * 60 * 1000),
      domain: 'AI',
      campus: 'North Campus',
      postedBy,
    },
  ];

  const inserted = await Job.insertMany(jobs);
  console.log(`Seeded ${inserted.length} jobs`);
}

seedJobs()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Seed failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
