const router = require('koa-router')()
const sql = require('mssql')
const moment = require('moment')

/**
 * Function to clean up white spaces around string
 * @param {string} location
 */
const formatString = (location) => location.trim()

/**
 * Function to clean up data by formatting date and trimming strings
 * @param {object} data
 * @return {object}
 */
const cleanupData = (data) => {
  return data.map((datum) => {
    return Object.keys(datum).reduce((acc, curr) => {
      switch (curr) {
        case 'PRDDATE':
          acc[curr] = formatDate(datum[curr])
          break
        case 'LOCATION':
        case 'BATCH':
        case 'PRODUCT':
          acc[curr] = formatString(datum[curr])
          break
        default:
          acc[curr] = datum[curr]
      }
      return acc
    }, {})
  })
}

/**
 * Function to group array of objects by key
 * @param {object} data
 * @param {string} key
 * @return {object}
 */
const groupBy = (data, key) => {
  return data.reduce((acc, curr) => {
    if (!acc[curr[key]]) { acc[curr[key]] = [] }
    acc[curr[key]].push(curr)
    return acc
  }, {})
}

/**
 * Converts date to moment object
 * @param {string} date
 * @returns {moment}
 */
const formatDate = (date) => {
  const newDate = []
  const currDate = date.toString()
  for (let i = 0; i < currDate.length; i++) {
    newDate.push(currDate[i])
    if (i === 3 || i === 5) {
      newDate.push('/')
    }
  }
  return moment(new Date(newDate.join(''))).format('MMMM, DD')
}

router
/**
 * Route to get the overall factory data
 */
  .get('/:fromDate/:toDate', async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    const { fromDate, toDate } = ctx.params
    console.log(fromDate, toDate)
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
      const formattedData = groupBy(cleanupData(result.recordset), 'LOCATION')
      ctx.body = formattedData
      await sql.close()
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

  /**
   * Route to get the batch data for each factory
   */
  .get('/batchdata/:fromDate/:toDate', async (ctx, next) => {
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
      const result = await pool.request().query(
        `SELECT LOCATION, BATCH, PRODUCT, PRDDATE, SAMS, PRODQTY, SAMPRD, NOFMAC
        FROM daily_prod(${fromDate}, ${toDate})`
      )
      const cleanData = cleanupData(result.recordset)
      const groupedData = groupBy(cleanData, 'PRDDATE')
      const updatedData = Object.keys(groupedData).reduce((acc, curr) => {
        const temp = groupBy(groupedData[curr], 'LOCATION')
        acc[curr] = temp
        return acc
      }, {})
      ctx.body = updatedData
      await sql.close()
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

module.exports = router
