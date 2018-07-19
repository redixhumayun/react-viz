const router = require('koa-router')()
const sql = require('mssql')

router
  .get('/:fromDate/:toDate', async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    const { fromDate, toDate } = ctx.params
    try {
      const config = {
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_HOSTIP,
        database: 'PPMDAT'
      }
      const pool = await new sql.ConnectionPool(config).connect()
      const result = await pool.request().query(`SELECT LOCATION,
                    PRDDATE,
                    TTLSAMS,
                    TTLMAC,
                    CAST((TTLSAMS/(TTLMAC*480)*100) as DECIMAL(16, 4)) AS SEW_EFF
                    FROM (
                      SELECT LOCATION, PRDDATE, CAST(SUM(SAMPRD) as DECIMAL(16, 0)) AS TTLSAMS,
                      AVG(NOFMAC) as TTLMAC FROM daily_prod(${fromDate}, ${toDate}) GROUP BY LOCATION, PRDDATE
                    ) AS P GROUP BY LOCATION, PRDDATE, TTLSAMS, TTLMAC`)
      sql.close()
      ctx.body = result
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

module.exports = router
