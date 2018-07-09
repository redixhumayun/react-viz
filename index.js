const Koa = require('koa')
require('dotenv').config()
const router = require('./src/routes')

const app = new Koa()
const PORT = 8080

const server = app.listen(PORT, async () => {
  console.log('Server listening on port: ', PORT)
})

app
  .use(router.routes())
  .use(router.allowedMethods())
