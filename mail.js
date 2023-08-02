const nodemailer = require("nodemailer");
require("dotenv").config();

module.exports = async (emails, text) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: false,
    auth: {
      user: "dipeshraval0007@gmail.com",
      pass: "obuxcprcgquavztc",
    },
  });

  await transporter.sendMail(
    {
      from: "dipeshraval0007@gmail.com",
      to: emails,
      subject: "Hello ✔",
      text: text,
      html: "<b>Hello world?</b>",
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
