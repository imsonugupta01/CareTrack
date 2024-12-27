const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const multer = require("multer");
const { ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { storage } = require("../firebase/firebaseConfig");
const path = require("path");

const storageConfig = multer.memoryStorage(); // Store files in memory as buffers
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png|gif/; // Supported file types
  const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = fileTypes.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error("Only images (jpeg, jpg, png, gif) are allowed")); // Reject the file
  }
};

const upload = multer({
  storage: storageConfig,
  fileFilter: fileFilter,
});

// Generate JWT Token
const generateAuthToken = (user) => {
  const payload = { user: user._id };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Doctor Signup
exports.DoctorSignup = [
  upload.single("image"), // Expecting 'image' as the form-data field
  async (req, res) => {
    try {
      const { name, specialization, email, degree, rate, description, password } = req.body;
      const file = req.file; // Multer processes the file and makes it available as `req.file`

      if (!file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      const existingUser = await Doctor.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Doctor already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a storage reference in Firebase Storage
      const storageRef = ref(storage, `doctor-images/${Date.now()}_${file.originalname}`);
      // Upload the image file to Firebase Storage
      await uploadBytes(storageRef, file.buffer);

      // Get the download URL of the uploaded image
      const imageUrl = await getDownloadURL(storageRef);

      const newDoctor = new Doctor({ name, specialization, email, degree, rate, description, imageUrl, password: hashedPassword });

      // Save the new doctor to the database
      await newDoctor.save();

      const token = generateAuthToken(newDoctor);
      res.status(201).json({
        message: "Doctor created successfully",
        doctor: newDoctor,
        token,
      });
    } catch (error) {
      console.error("Error creating doctor:", error);
      res.status(500).json({ message: "Server error", error });
    }
  },
];

// Patient Signup
exports.Patientsignup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await Patient.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const Walletbalance = 0;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newPatient = new Patient({ name, email, password: hashedPassword, Walletbalance });
    await newPatient.save();

    const token = generateAuthToken(newPatient);
    res.status(201).json({ message: 'User created successfully', token, newPatient });
  } catch (error) {
    console.error("Error while signing up:", error);
    res.status(500).json({ message: 'Error while signing up', error });
  }
};

// Patient Login
exports.PatientLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const patient = await Patient.findOne({ email });
    if (!patient) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, patient.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = generateAuthToken(patient);
    res.json({ token, patient });
  } catch (error) {
    console.error("Error while logging in:", error);
    res.status(500).json({ message: 'Error while logging in', error });
  }
};

// Doctor Login
exports.DoctorLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = generateAuthToken(doctor);
    res.json({ token, doctor });
  } catch (error) {
    console.error("Error while logging in doctor:", error);
    res.status(500).json({ message: 'Error while logging in', error });
  }
};
