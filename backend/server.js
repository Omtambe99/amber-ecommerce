const { createApp } = require("./app");

const port = Number(process.env.PORT || 3001);
const app = createApp();

app.listen(port, "0.0.0.0", (error) => {
  if (error) {
    console.error(
      `Could not start the backend on port ${port}: ${error.message}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Backend listening at http://localhost:${port}`);
});
