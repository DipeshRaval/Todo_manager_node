const nodemailer = require("nodemailer");
require("dotenv").config();

module.exports = async (emails, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: false,
    auth: {
      user: process.env.email,
      pass: process.env.password,
    },
  });

  await transporter.sendMail(
    {
      from: process.env.email,
      to: emails,
      subject: subject,
      text: text,
    },
    function (err, data) {
      if (err) {
        console.log(err, data);
      } else {
        console.log("Email Sent Successfully");
      }
    }
  );
};
