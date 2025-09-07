const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer"); // added

const app = express();
app.use(cors());
app.use(bodyParser.json());

const SECRET_KEY = "secretkey"; // In production, use env variable
const MONGO_URI = "mongodb+srv://monthly:root@cluster0.uv5la.mongodb.net/adminlogin?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

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
  gmail: String,
  meals: { type: String, enum: ["1", "2", "3"] },
  startDate: Date,
  endDate: Date,
  totalAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
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

// Configure NodeMailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "rishabhgusain51@gmail.com",        // your Gmail
    pass: "eggi ucst xkip lnwj"           // app password, not normal password
  }
});

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

// Add Student + send Gmail
// Add Student + send dark theme Gmail
app.post("/students", authenticateToken, async (req, res) => {
  try {
    const { name, phone, gmail, meals, startDate, endDate, totalAmount, paidAmount } = req.body;

    if (!name || !phone || !gmail || !meals || !startDate || !endDate || totalAmount == null || paidAmount == null) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const pendingAmount = totalAmount - paidAmount;
    const status = new Date() <= new Date(endDate) ? "Active" : "Expired";

    const newStudent = new Student({
      name,
      phone,
      gmail,
      meals,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalAmount,
      paidAmount,
      pendingAmount
    });

    await newStudent.save();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {
    margin:0; padding:0; font-family: 'Helvetica Neue', Arial, sans-serif; background:#f5f5f5; color:#333;
  }
  .email-container {
    max-width:700px;
    margin:40px auto;
    background:#ffffff;
    border-radius:12px;
    overflow:hidden;
    box-shadow:0 8px 25px rgba(0,0,0,0.1);
  }
  .email-header {
    background: linear-gradient(90deg, #4facfe, #00f2fe);
    padding:40px 30px;
    text-align:center;
    color:white;
  }
  .email-header h1 {
    margin:0;
    font-size:34px;
    letter-spacing:1px;
  }
  .email-body {
    padding:35px 30px;
  }
  .email-body h2 {
    color:#4facfe;
    margin-top:0;
    font-size:28px;
  }
  .intro {
    font-size:18px;
    line-height:1.7;
    margin-bottom:25px;
  }
  .card {
    background:#f9f9f9;
    border-radius:12px;
    padding:25px;
    box-shadow:0 5px 15px rgba(0,0,0,0.05);
    margin-bottom:30px;
    border:1px solid #ddd;
  }
  .card p {
    margin:10px 0;
    font-size:18px;
  }
  .card p span {
    font-weight:bold;
    color:#00aaff;
  }
  .btn {
    display:inline-block;
    padding:15px 35px;
    background: linear-gradient(90deg, #4facfe, #00f2fe);
    color:white;
    text-decoration:none;
    border-radius:12px;
    font-size:18px;
    font-weight:bold;
    transition:0.3s;
  }
  .btn:hover { opacity:0.9; }
  .footer {
    text-align:center;
    padding:25px;
    background:#f1f1f1;
    color:#888;
    font-size:14px;
    border-top:1px solid #ddd;
  }
  @media(max-width:720px){
    .email-container{ margin:20px; }
    .email-header h1{ font-size:28px; }
    .email-body h2{ font-size:24px; }
    .card p{ font-size:16px; }
    .btn{ font-size:16px; padding:12px 28px; }
  }
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Monthly Tiffin Service</h1>
    </div>
    <div class="email-body">
      <h2>Hello ${name},</h2>
      <p class="intro">Welcome to our Tiffin Service! Your subscription details are listed below. Enjoy fresh meals delivered to you every day.</p>

      <div class="card">
        <p><span>Name:</span> ${name}</p>
        <p><span>Email:</span> ${gmail}</p>
        <p><span>Phone:</span> ${phone}</p>
        <p><span>Meals per Day:</span> ${meals}</p>
        <p><span>Subscription Start:</span> ${new Date(startDate).toLocaleDateString()}</p>
        <p><span>Subscription End:</span> ${new Date(endDate).toLocaleDateString()}</p>
        <p><span>Total Amount:</span> ₹${totalAmount}</p>
        <p><span>Paid Amount:</span> ₹${paidAmount}</p>
        <p><span>Pending Amount:</span> ₹${pendingAmount}</p>
      </div>

      <a href="#" class="btn">Visit Our Website</a>
    </div>
    <div class="footer">
      &copy; 2025 Monthly Tiffin Service. All rights reserved.
    </div>
  </div>
</body>
</html>
`;


    transporter.sendMail({
      from: '"Tiffin Service" <rishabhgusain51@gmail.com>',
      to: gmail,
      subject: "Welcome to Monthly Tiffin Service",
      html: htmlContent
    }, (err, info) => {
      if(err) console.error("❌ Email not sent:", err);
      else console.log("✅ Email sent:", info.response);
    });

    res.json({ message: "Student added successfully and email sent", student: newStudent });

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
// Update Student + send Gmail notification
app.put("/students/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, gmail, meals, totalAmount, paidAmount } = req.body;

    let pendingAmount;
    if (totalAmount != null && paidAmount != null) {
      pendingAmount = totalAmount - paidAmount;
    }

    const updatedData = { name, phone, gmail, meals };
    if (pendingAmount != null) {
      updatedData.totalAmount = totalAmount;
      updatedData.paidAmount = paidAmount;
      updatedData.pendingAmount = pendingAmount;
    }

    const updatedStudent = await Student.findByIdAndUpdate(id, updatedData, { new: true });
    if (!updatedStudent) return res.status(404).json({ message: "Student not found" });

    // Prepare email content (light theme)
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin:0; padding:0; font-family: 'Helvetica Neue', Arial, sans-serif; background:#f5f5f5; color:#333; }
  .email-container { max-width:700px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.1);}
  .email-header { background: linear-gradient(90deg, #4facfe, #00f2fe); padding:40px 30px; text-align:center; color:white;}
  .email-header h1 { margin:0; font-size:34px; letter-spacing:1px; }
  .email-body { padding:35px 30px; }
  .email-body h2 { color:#4facfe; margin-top:0; font-size:28px; }
  .intro { font-size:18px; line-height:1.7; margin-bottom:25px; }
  .card { background:#f9f9f9; border-radius:12px; padding:25px; box-shadow:0 5px 15px rgba(0,0,0,0.05); margin-bottom:30px; border:1px solid #ddd; }
  .card p { margin:10px 0; font-size:18px; }
  .card p span { font-weight:bold; color:#00aaff; }
  .btn { display:inline-block; padding:15px 35px; background: linear-gradient(90deg, #4facfe, #00f2fe); color:white; text-decoration:none; border-radius:12px; font-size:18px; font-weight:bold; transition:0.3s; }
  .btn:hover { opacity:0.9; }
  .footer { text-align:center; padding:25px; background:#f1f1f1; color:#888; font-size:14px; border-top:1px solid #ddd; }
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Monthly Tiffin Service</h1>
    </div>
    <div class="email-body">
      <h2>Hello ${updatedStudent.name},</h2>
      <p class="intro">Your account details have been updated. Please find the latest information below:</p>
      <div class="card">
        <p><span>Name:</span> ${updatedStudent.name}</p>
        <p><span>Email:</span> ${updatedStudent.gmail}</p>
        <p><span>Phone:</span> ${updatedStudent.phone}</p>
        <p><span>Meals per Day:</span> ${updatedStudent.meals}</p>
        <p><span>Total Amount:</span> ₹${updatedStudent.totalAmount}</p>
        <p><span>Paid Amount:</span> ₹${updatedStudent.paidAmount}</p>
        <p><span>Pending Amount:</span> ₹${updatedStudent.pendingAmount}</p>
      </div>
      <a href="#" class="btn">Visit Our Website</a>
    </div>
    <div class="footer">
      &copy; 2025 Monthly Tiffin Service. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

    // Send email
    transporter.sendMail({
      from: '"Tiffin Service" <rishabhgusain51@gmail.com>',
      to: updatedStudent.gmail,
      subject: "Your Tiffin Service Account Updated",
      html: htmlContent
    }, (err, info) => {
      if(err) console.error("❌ Email not sent:", err);
      else console.log("✅ Email sent:", info.response);
    });

    res.json({ message: "Student updated successfully and email sent", student: updatedStudent });

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

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
