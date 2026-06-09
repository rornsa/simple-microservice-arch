import http from "http";
import express from "express";
import routes from "./connect";
import { expressConnectMiddleware } from "@connectrpc/connect-express";

const app = express();

// Use the ConnectRPC middleware with Express
app.use(expressConnectMiddleware({
  routes
}));

// Basic health check
app.get("/", (req, res) => {
  res.send("Auth Service (Express) is running");
});

const PORT = 8001;
http.createServer(app).listen(PORT, () => {
  console.log(`[Auth Service] ConnectRPC (Express) server running on http://localhost:${PORT}`);
});
