const router = require('koa-router')()
const sql = require('mssql')

router
  .get('/:fromDate/:toDate', async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    const { fromDate, toDate } = ctx.params
    try {
      await sql.connect(`mssql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOSTIP}/PPMDAT`)
      let result = await sql.query`SELECT LOCATION, PRDDATE, CAST(SUM(SAMPRD) as DECIMAL(16, 0)) AS TTLSAMS,
                        SUM(NOFMAC) as TTLMAC FROM daily_prod(${fromDate}, ${toDate}) AS P GROUP BY LOCATION, PRDDATE`
      sql.close()
      ctx.body = result
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

module.exports = router
