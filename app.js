/* eslint-disable no-unused-vars */
const express = require("express");
const app = express();
const { Todo, User } = require("./models");
const cookieParser = require("cookie-parser");
// const csrf = require("csurf");
const csrf = require("tiny-csrf");
const bodyParser = require("body-parser");
const path = require("path");
const { response } = require("express");
require("dotenv").config();

const cron = require("node-cron");
const mail = require("./mail");

//flash
const flash = require("connect-flash");
app.set("views", path.join(__dirname, "views"));
app.use(flash());

//passport js for aurthentication
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const LocalStrategy = require("passport-local");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const bcrypt = require("bcrypt");
const saltRound = 10;

app.use(
  session({
    secret: "my-secret-ket-232423234234234234",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// creating passport stretargy
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({
        where: {
          email: username,
        },
      })
        .then(async (user) => {
          // console.log(user.email);
          if (user) {
            const bool = await bcrypt.compare(password, user.password);
            if (bool) {
              return done(null, user);
            } else {
              return done(null, false, {
                message: "Invalid password",
              });
            }
          } else {
            return done(null, false, {
              message: "With This email user doesn't exists",
            });
          }
        })
        .catch((error) => {
          return done(error);
        });
    }
  )
);

//google stretergy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:"https://todo-manager-nqig.onrender.com/auth/google/callback",
      passReqToCallback: true,
    },
    function (request, accessToken, refreshToken, profile, done) {
      // console.log("profile : " + profile);
      User.findOne({
        where: {
          email: profile.email,
        },
      })
        .then(async (user) => {
          // console.log(user.email);
          if (user) {
            return done(null, user);
          } else {
            return done(null, false, {
              message: "With This email user doesn't exists",
            });
          }
        })
        .catch((error) => {
          return done(error);
        });
    }
  )
);
passport.serializeUser((user, done) => {
  console.log("Serialize the user with Id : ", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname + "/public")));
// app.use(express.static("public"));

// for csrf token
// app.use(cookieParser("shh! some secret string"));
app.use(cookieParser("Important string"));
app.use(csrf("123456789iamasecret987654321look", ["POST", "PUT", "DELETE"]));

// for the flash
app.use(function (req, res, next) {
  const data = req.flash();
  res.locals.messages = data;
  next();
});

//End-POints
app.get("/", async (req, res) => {
  if (req.session.passport) {
    res.redirect("/todos");
  } else {
    res.render("index", {
      title: "Todo Application",
      csrfToken: req.csrfToken(),
    });
  }
});

app.get("/todos", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const loginUserId = req.user.id;
  console.log(req.user);
  console.log(req.user.id);
  console.log(req.user.firstName);
  // const allTodos = await Todo.getTodos();
  const overdue = await Todo.overDue(loginUserId);
  const dueLater = await Todo.dueLater(loginUserId);
  const dueToday = await Todo.dueToday(loginUserId);
  const completedItems = await Todo.completedItems(loginUserId);
  if (req.accepts("html")) {
    res.render("todosPage", {
      // allTodos,
      overdue,
      dueLater,
      dueToday,
      completedItems,
      user: req.user.firstName,
      csrfToken: req.csrfToken(),
    });
  } else {
    res.json({
      overdue,
      dueToday,
      dueLater,
      completedItems,
    });
  }
});

app.post("/todos", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  console.log(req.body.dueDate);
  console.log("Body : ", req.body);
  console.log(req.user);
  try {
    const title = req.body.title;
    console.log(title.trim().length);
    await Todo.addTodo({
      title: title.trim(),
      dueDate: req.body.dueDate,
      completed: false,
      userId: req.user.id,
    });
    return res.redirect("/todos");
  } catch (error) {
    console.log(error);
    console.log(error.name);
    if (error.name == "SequelizeValidationError") {
      error.errors.forEach((e) => {
        if (e.message == "Title length must greater than 5") {
          req.flash("error", "Title length must greater than or equal to 5");
        }
        if (e.message == "Please enter a valid date") {
          req.flash("error", "Please enter a valid date");
        }
      });
      return res.redirect("/todos");
    } else {
      return response.status(422).json(error);
    }
  }
});

app.put("/todos/:id", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  console.log(req.body);
  console.log("Todo marks completed : ", req.params.id);
  const todo = await Todo.findByPk(req.params.id);
  try {
    const updateTodo = await todo.setCompletionStatus(req.body.completed);
    return res.json(updateTodo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

// eslint-disable-next-line no-unused-vars
app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    console.log("We have to delete a Todo with ID: ", req.params.id);
    try {
      const affectedRow = await Todo.remove(req.params.id, req.user.id);
      res.send(affectedRow ? true : false);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

// login routes
app.get("/signup", (req, res) => {
  res.render("signup", {
    title: "signUp",
    csrfToken: req.csrfToken(),
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    title: "login",
    csrfToken: req.csrfToken(),
  });
});

app.get("/signout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    console.log(req.user);
    res.redirect("/todos");
  }
);

app.post("/users", async (req, res) => {
  console.log("Body : ", req.body.firstName);
  const pwd = await bcrypt.hash(req.body.password, saltRound);
  try {
    const user = await User.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: pwd,
    });
    req.logIn(user, (err) => {
      if (err) {
        console.log(err);
      }
      return res.redirect("/todos");
    });
  } catch (error) {
    console.log(error);
    console.log(error.name);
    if (error.name == "SequelizeValidationError") {
      error.errors.forEach((e) => {
        if (e.message == "Please provide a firstName") {
          req.flash("error", "Please provide a firstName");
        }
        if (e.message == "Please provide email_id") {
          req.flash("error", "Please provide email_id");
        }
      });
      return res.redirect("/signup");
    } else if (error.name == "SequelizeUniqueConstraintError") {
      error.errors.forEach((e) => {
        if (e.message == "email must be unique") {
          req.flash("error", "User with this email already exists");
        }
      });
      return res.redirect("/signup");
    } else {
      return response.status(422).json(error);
    }
  }
});

app.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    res.redirect("/todos");
  }
);

const mailHandler = async () => {
  // code to send emails here...
  const today = new Date().toISOString().split("T")[0];

  const inCompleteTodos = await Todo.inCompletedByToday(today);

  let sendMailUser = inCompleteTodos.map((todo) => todo.userId);
  sendMailUser = [...new Set(sendMailUser)];

  sendMailUser.forEach(async (userId) => {
    const user = await User.findByPk(userId);

    const reaminsTodosForUser = await Todo.reaminsTodosForUser(today, userId);

    let taskList = reaminsTodosForUser.map((todo, i) => {
      return `${i + 1} ${todo.title}`;
    });

    mail(
      user.email,
      "Friendly Reminder: Pending To-Do's Update",
      `Dear ${user.firstName},

      I hope this email finds you well. As a gentle reminder, our server has detected a few pending to-do items associated with your account. We encourage you to take a moment to review and complete these tasks for smoother workflow and better organization.

      Here's a quick summary of your pending to-do's:

      ${taskList.join("")}

      Please log in to your account and access the 'To-Do' section to view the detailed list and associated deadlines. Our team is always available to assist you with any questions or clarifications you may have regarding these tasks.

      Taking prompt action on these pending to-do's will not only help you stay on top of your responsibilities but also contribute to the overall efficiency of our operations.

      If you have already completed any of these tasks, kindly ignore this email. We appreciate your attention to this matter and thank you for using our platform to manage your tasks.

      Thank you for your cooperation.
      Best regards,
      Todo App`
    );
  });
};

cron.schedule(
  "03 13 * * *",
  () => {
    try {
      mailHandler();
    } catch (error) {
      console.log(error);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

module.exports = app;
