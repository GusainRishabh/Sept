const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Serve static frontend safely
const frontendPath = path.join(__dirname, ""); // make sure index.html is here
app.use(express.static(frontendPath));

// Catch-all route for frontend (React SPA)
app.get(/^\/(?!api|students|login|register).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const SECRET_KEY = process.env.SECRET_KEY;
const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Admin/User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

// Student Schema
const studentSchema = new mongoose.Schema({
  name: String,
  phone: String,
  meals: String,
  totalAmount: Number,
  paidAmount: Number,
  pendingAmount: Number,
  startDate: Date,
  endDate: Date,
  nextPaymentDate: Date,
});
const Student = mongoose.model("Student", studentSchema);
// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

// Register Admin
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    res.json({ message: "Admin registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "User already exists or DB error" });
  }
});

// Login API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: "4days" });
  res.json({ message: "Login successful", token });
});

// Add Student
app.post("/students", authenticateToken, async (req, res) => {
  try {
    const { name, phone,  meals, startDate, endDate, totalAmount, paidAmount } = req.body;

    if (!name || !phone  || !meals || !startDate || !endDate || totalAmount == null || paidAmount == null) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const pendingAmount = totalAmount - paidAmount;

    const newStudent = new Student({
      name,
      phone,
      meals,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalAmount,
      paidAmount,
      pendingAmount,
    });

    await newStudent.save();

    res.json({ message: "Student added successfully", student: newStudent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error adding student" });
  }
});

// Get all students
app.get("/students", authenticateToken, async (req, res) => {
  const students = await Student.find();
  res.json(students);
});

// Update Student
app.put("/students/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, meals, totalAmount, paidAmount, startDate, endDate } = req.body;

    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (name) student.name = name;
    if (phone) student.phone = phone;
    if (meals) student.meals = meals;
    if (totalAmount != null) student.totalAmount = totalAmount;
    if (paidAmount != null) student.paidAmount = paidAmount;

    if (startDate) student.startDate = new Date(startDate);
    if (endDate) student.endDate = new Date(endDate);

    if (totalAmount != null && paidAmount != null) {
      student.pendingAmount = totalAmount - paidAmount;
    }

    if (student.endDate) {
      const nextPayment = new Date(student.endDate);
      nextPayment.setMonth(nextPayment.getMonth() + 1);
      student.nextPaymentDate = nextPayment;
    }

    await student.save();
    res.json({ message: "Student updated successfully", student });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating student" });
  }
});

// Delete Student
app.delete("/students/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Student.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Student not found" });

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting student" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
