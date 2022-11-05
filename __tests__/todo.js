/* eslint-disable no-undef */
const request = require("supertest");
var cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");
let server;
let agent;

function getCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

describe("Test case for database", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Creates a todo", async () => {
    var res = await agent.get("/");
    var csrfToken = getCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Mark todo as a completed (updating todo)", async () => {
    var res = await agent.get("/");
    var csrfToken = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "Do HomeWork",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const Todos = await agent.get("/").set("Accept", "application/json");
    const parseTodos = JSON.parse(Todos.text);
    const countTodaysTodos = parseTodos.dueToday.length;
    const Todo = parseTodos.dueToday[countTodaysTodos - 1];
    const status = Todo.completed ? false : true;
    res = await agent.get("/");
    csrfToken = getCsrfToken(res);

    const changeTodo = await agent
      .put(`/todos/${Todo.id}`)
      .send({ _csrf: csrfToken, completed: status });

    const parseUpadteTodo = JSON.parse(changeTodo.text);
    expect(parseUpadteTodo.completed).toBe(true);
  });

  test("Deletes a todo with the given ID if it exists and sends a boolean response", async () => {
    var res = await agent.get("/");
    var csrfToken = getCsrfToken(res);
    await agent.post("/todos").send({
      title: "Buy xbox",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const Todos = await agent.get("/").set("Accept", "application/json");
    const parseTodos = JSON.parse(Todos.text);
    const countTodaysTodos = parseTodos.dueToday.length;
    const Todo = parseTodos.dueToday[countTodaysTodos - 1];
    const todoID = Todo.id;

    res = await agent.get("/");
    csrfToken = getCsrfToken(res);

    const rese = await agent
      .delete(`/todos/${todoID}`)
      .send({ _csrf: csrfToken });

    const bool = Boolean(rese.text);
    expect(bool).toBe(true);
  });
});
