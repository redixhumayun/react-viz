const router = require('koa-router')()
const sql = require('mssql')
const moment = require('moment')
const cron = require('node-cron')
const nodemailer = require('nodemailer')

  // var task = cron.schedule('51 18 * * *', () => {
  //   console.log('Running cron task')
  // }, {
  //   scheduled: false,
  //   timezone: 'Asia/Kolkata'
  // })

  // task.start()

; (async () => {
  try {
    const config = {
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_HOSTIP,
      database: 'PPMDAT'
    }
    const fromDate = moment().subtract(1, 'days').format('YYYYMMDD')
    const toDate = moment().subtract(1, 'days').format('YYYYMMDD')
    const pool = await new sql.ConnectionPool(config).connect()
    const result = await pool.request().query(`SELECT PRDDATE,
                                                (TTLSAMS/(NULLIF(TTLMAC * 480, 0))) * 100 AS EFF
                                                FROM(
                                                  SELECT PRDDATE, SUM(NOFMAC) as TTLMAC, SUM(SAMPRD) as TTLSAMS
                                                  FROM daily_prod(${fromDate}, ${toDate})
                                                  GROUP BY PRDDATE
                                                ) AS P GROUP BY PRDDATE, TTLMAC, TTLSAMS`)
    const formattedResult = cleanupData(result.recordset)
    dispatchMail(formattedResult[0])
    await sql.close()
  } catch (error) {
    console.log(error)
    sql.close()
  }
})()

function dispatchMail ({ PRDDATE, EFF }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'redixhumayun@gmail.com',
      pass: 'ovdlnxindbfqoibq'
    }
  })

  const formattedDate = moment(PRDDATE).format('dddd, MMMM DD, YYYY')

  const mailOptions = {
    from: 'redixhumayun@gmail.com',
    to: 'zaid.humayun93@gmail.com',
    subject: 'Subject',
    html: `<p>Date: ${formattedDate}, Sewing Eff: ${EFF}%</p>`
  }

  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log(err)
    } else {
      console.log(info)
    }
  })
}

/**
 * Function to clean up white spaces around string
 * @param {string} location
 */
const formatString = (location) => location.trim()

/**
 * Converts date to moment object
 * @param {string} number
 * @returns {moment}
 */
const formatDate = (date) => {
  return moment(date.toString()).format('YYYY-MM-DD')
}

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
 * Function to group array of objects by key and then separate them into multiple arrays. Returns 2d array
 * @param {object} data
 * @param {string} key
 * @return {array}
 */
const groupBy = (data, key) => {
  return data.reduce((acc, curr) => {
    if (!acc[curr[key]]) { acc[curr[key]] = [] }
    acc[curr[key]].push(curr)
    return acc
  }, {})
}

/**
 * Function to to convert the grouped object into a format compatible with D3
 * @param {Object} data
 * @param {String} key
 */
const convertToArray = (data, key) => {
  return Object.entries(data).reduce((acc, [k, dataForDate]) => {
    let reducedData = dataForDate.reduce((acc, dataForFactory) => {
      let keyInObject = dataForFactory[key]
      let eff = dataForFactory['EFF']
      let date = dataForFactory['PRDDATE']
      acc[keyInObject] = eff
      acc['PRDDATE'] = date
      return acc
    }, {})
    acc.push(reducedData)
    return acc
  }, [])
}

router

  /**
   * Route to get the efficiency of each factory on a single day in descending order of EFF
   * Includes LOCATION, PRDDATE, EFF, TTLPROD
   */
  .get('/factoryEffOrder/:date', async (ctx) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    const { date } = ctx.params
    try {
      const config = {
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_HOSTIP,
        database: 'PPMDAT'
      }
      const pool = await new sql.ConnectionPool(config).connect()
      const result = await pool.request().query(
        `SELECT LOCATION,
                PRDDATE,
                (TTLSAMS/(NULLIF(TTLMAC * 480, 0))) * 100 AS EFF,
                TTLPROD
                FROM(
                    SELECT LOCATION, PRDDATE, SUM(NOFMAC) as TTLMAC, SUM(SAMPRD) as TTLSAMS, SUM(PRODQTY) as TTLPROD
                    FROM daily_prod(${date}, ${date})
                    GROUP BY LOCATION, PRDDATE
                ) AS P GROUP BY LOCATION, PRDDATE, TTLMAC, TTLSAMS, TTLPROD ORDER BY EFF DESC`
      )
      ctx.body = result.recordset
      await sql.close()
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

  /**
   * Data for a single day across factories
   */
  .get('/:fromDate/:toDate', async (ctx) => {
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
                                                  (TTLSAMS/(NULLIF(TTLMAC * 480, 0))) * 100 AS EFF
                                                  FROM(
                                                    SELECT LOCATION, PRDDATE, SUM(NOFMAC) as TTLMAC, SUM(SAMPRD) as TTLSAMS
                                                    FROM daily_prod(${fromDate}, ${toDate})
                                                    GROUP BY LOCATION, PRDDATE
                                                  ) AS P GROUP BY LOCATION, PRDDATE, TTLMAC, TTLSAMS`)
      const formattedData = cleanupData(result.recordset)
      const groupedData = groupBy(formattedData, 'PRDDATE')
      const arrayData = convertToArray(groupedData, 'LOCATION')
      ctx.body = arrayData
      await sql.close()
    } catch (error) {
      sql.close()
    }
  })

  /**
   * Route to get the overall factory data
   */
  .get('/averageEff/:fromDate/:toDate', async (ctx) => {
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
      const result = await pool.request().query(`SELECT PRDDATE,
                                                    (TTLSAMS/(NULLIF(TTLMAC * 480, 0))) * 100 AS EFF
                                                    FROM(
                                                      SELECT PRDDATE, SUM(NOFMAC) as TTLMAC, SUM(SAMPRD) as TTLSAMS
                                                      FROM daily_prod(${fromDate}, ${toDate})
                                                      GROUP BY PRDDATE
                                                    ) AS P GROUP BY PRDDATE, TTLMAC, TTLSAMS`)
      ctx.body = cleanupData(result.recordset)
      await sql.close()
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

  /**
   * Route to get the batch data for a factory on a single day
   */
  .get('/batchdata/:date/:location', async (ctx) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    const { date, location } = ctx.params
    try {
      const config = {
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_HOSTIP,
        database: 'PPMDAT'
      }
      const pool = await new sql.ConnectionPool(config).connect()
      const result = await pool.request().query(
        `SELECT LOCATION, BATCH, PRODUCT, PRDDATE,
        (SAMPRD/NULLIF(NOFMAC * 480, 0)) * 100 as EFF
        FROM (
          SELECT LOCATION, BATCH, PRODUCT, PRDDATE, NOFMAC, SAMPRD, PRODQTY
          FROM daily_prod(${date}, ${date}) WHERE LOCATION = '${location}'
        ) AS P GROUP BY LOCATION, BATCH, PRODUCT, PRDDATE, NOFMAC, SAMPRD, PRODQTY`
      )
      const formattedData = cleanupData(result.recordset)
      const groupedData = groupBy(formattedData, 'PRDDATE')
      const arrayData = convertToArray(groupedData, 'BATCH')
      ctx.body = arrayData
      await sql.close()
    } catch (error) {
      console.log(error)
      sql.close()
    }
  })

module.exports = router
