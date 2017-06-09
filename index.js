const fs = require('fs')
const url = require('url')

const request = require('request')
const cheerio = require('cheerio')
const Promise = require('bluebird')

const cinemas = require('./cinemas.json')

/**
 * Grab a webpage, parse with jquery and return the jquery object
 * @param  {String}   url      the URL
 * @param  {Function} callback the Callback
 */
function fetchURL (url, callback) {
  console.log('fetching', url, '...')
  request.get(url, function (error, response, body) {
    if (error) {
      console.log(error)
    } else {
      callback(cheerio.load(body), url)
    }
  })
}

/**
 * Append data to a file (create it if not exist)
 * @param  {String} filename the file path
 * @param  {Any}    data     data
 */
function save (filename, data) {
  var dataString = typeof data === 'object' ? JSON.stringify(data) : data.toString()
  dataString += '\n' // append a newline
  fs.appendFile(filename, dataString, function (error) {
    if (error) console.log(error)
  })
}

const movies = {}

function fetchAPI(api, cinema, date) {
  return new Promise(resolve => {
    fetchURL(api, function ($) {
      let data = JSON.parse($('script').filter(function () {
        return $(this).text().match(/scheduleList=/)
      }).text().replace('var scheduleList=', ''))

      for (let room in data.play_info) {
        for (let movie of data.play_info[room]) {
          if (!movies[movie.film_name]) movies[movie.film_name] = []
          movies[movie.film_name].push(Object.assign({}, movie, {
            cinema, date, room
          }))
        }
      }

      resolve()
    })
  })
}

var promises = []
for (let day = 17; day <= 26; ++day) {
  let date = '2017-06-' + day
  for (let cinema of cinemas) {
    let api = `http://www.siff.com/app/schedule.php?lg=chinese&date=${date}&cinema=${encodeURIComponent(cinema)}`
    promises.push(fetchAPI(api, cinema, date))
  }
}

Promise.map(promises, p => p, {concurrency: 5}).then(() => {
  save('data.json', JSON.stringify(movies, null, '  '))

  let md = '# 排片表'
  for (let name in movies) {
    md += `\n\n## ${name}\n`
    md += `导演：${movies[name][0].director || ''}  \n类型：${movies[name][0].film_type_name}\n\n`
    md += '|影院|日期|开始时间|时长|影厅|\n'
    md += '| ---- | ---- | ---- | ---- | ---- |\n'
    for (let movie of movies[name]) {
      md += `|${movie.cinema || ''}|${movie.date || ''}|${movie.show_time || ''}|${movie.film_total_time || ''}|${movie.room || ''}|\n`
    }
    md += '\n'
  }
  save('data.md', md)
})
