// sheet
let sheet = 'CMS!'
// column letters
let titles = 'A'
let urls = 'B'
let tags = 'C'
let dates = 'D'
let contents = 'E'
// rows 
let firstContentRow = 4

//special queries
let lastedit = sheet + 'B1'

// parsers
let getAll = (column, row) => sheet + column + row + ':' + column
let get = (column, row) => sheet + column + row

const queries = {
    titles: getAll(titles, firstContentRow),
    links: getAll(urls, firstContentRow),
    tags: getAll(tags, firstContentRow),
    dates: getAll(dates, firstContentRow),
    contents: getAll(contents, firstContentRow),
    posts: [getAll(titles, firstContentRow), getAll(urls, firstContentRow), getAll(tags, firstContentRow), getAll(dates, firstContentRow), lastedit],
}
const apikey = 'AIzaSyDLgbHuIKYEhhDoVz9pdwkU4LgqNGMQT3A'
const sheetid = '17mMZ4fb-IpTDbqoTxdjF_EeRpnoJuef58yMHIQI9Ri4'
const base = 'https://sheets.googleapis.com/v4/spreadsheets/'

let content = document.getElementById('content')

const buildQuery = (query) => new Promise((resolve, reject) => {
    if (!query) {
        reject('404')
    }
    else if (Array.isArray(query)) {
        //parse a batch query
        let ranges = ''
        query.map((range, index) => (index === 0) ? ranges += 'ranges=' + range : ranges += '&ranges=' + range)
        resolve(base + sheetid + '/values:batchGet?' + ranges + '&key=' + apikey)
    }
    else {
        // parse a single query
        resolve(base + sheetid + '/values/' + query + '?key=' + apikey)
    }
})

const getQuery = async (url) => new Promise((resolve, reject) => {
    fetch(url)
        .then(response => response.json())
        .then(query => resolve(query))
        .catch(err => reject(err))
})

const parseQuery = async (query) => new Promise((resolve, reject) => {
    let result = {}
    if (typeof query !== 'object') {
        console.log('query not object')
        reject('404')
    }
    else if (query.valueRanges) {
        if (query.valueRanges.length !== 5) {
            console.log('query incorrect length')
            reject('404')
        } else {
            result.titles = query.valueRanges[0].values
            result.links = query.valueRanges[1].values
            result.tags = query.valueRanges[2].values
            result.dates = query.valueRanges[3].values
            result.lastedit = query.valueRanges[4].values
            resolve(result)
        }
    }
    else if (query.values) {
        result.post = query.values
        resolve(result)
    }
})

const buildHome = (result) => new Promise((resolve, reject) => {
    let blog = `<ul class="posts">
      ${result.titles.map((title, index) => `<li class="post-title"><a href="/${result.links[index]} ">${title}</a></li>`).join('')}
      </ul>`
    resolve(blog)
})

const buildRoutes = async (result) => new Promise((resolve, reject) => {
    let routes = {}
    result.lastedit = routes.lastedit
    buildHome(result)
        .then(home => {
            routes['/'] = home
            routes['/index.html'] = home
        })
        .then(() => result.links.map((link, index) => routes['/' + link] = index + firstContentRow))
        .then(() => console.log('routes: ' + JSON.stringify(routes)))
        .then(() => resolve(routes))
})

const followRoute = (routes) => {
    let path = routes[window.location.pathname]
    return new Promise((resolve, reject) => {
        if (typeof path === 'number') {
            let post = get(contents, path)
            buildQuery(post)
                .then(url => getQuery(url))
                .then(query => parseQuery(query))
                .then(result => resolve(result.post))
                .catch(err => reject(err))
        }
        else {
            resolve(path)
        }
    })
}


const checkCache = () => new Promise((resolve, reject) => {
    let localroutes = window.localStorage.getItem('routes')
    if (!localroutes) {
        reject('No local routes found')
    } else {
        buildQuery(lastedit)
            .then(url => getQuery(url))
            .then(result => {
                console.log(result.values[0][0])
                if (typeof parseInt(result.values[0][0]) !== 'number') {
                    reject('invalid lastedit')
                }
                else {
                    let routes = JSON.parse(localroutes)
                    if (result > routes.lastedit) {
                        window.localStorage.clear()
                        reject('local routes old, getting new ones')
                    }
                    else {
                        resolve(routes)
                    }
                }
            })
    }
})

const renderRoutes = async (routes) => {
    window.onpopstate = async () => {
        content.innerHTML = await followRoute(routes)
    }
    // let onNavItemClick = (pathName) => {
    //   window.history.pushState({}, pathName, window.location.origin + pathName)
    //   content.innerHTML = routes[pathName]
    // }
    content.innerHTML = await followRoute(routes)
}

const buildSite = async () => {
    checkCache()
        .then(routes => renderRoutes(routes))
        .catch(err => {
            console.log(err)
            buildQuery(queries.posts)
                .then(url => getQuery(url))
                .then(query => parseQuery(query))
                .then(result => buildRoutes(result))
                .then(routes => {
                    renderRoutes(routes)
                    window.localStorage.setItem('routes', JSON.stringify(routes))
                })
                .catch(err => console.log(err))
        })
}
buildSite()