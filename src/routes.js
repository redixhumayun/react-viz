const router = require('koa-router')()
const sql = require('mssql')

router
  .get('/', async (ctx, next) => {
    try {
      let pool = await sql.connect('mssql://zaid:zh@1993@106.51.141.193/PPMDAT')
      let result = await sql.query`select top 100 * from DAILY_PROD(20180201, 20180210)`
      sql.close()
      ctx.body = result
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

module.exports = router
