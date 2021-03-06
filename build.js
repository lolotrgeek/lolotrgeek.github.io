


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
let lastEdit = sheet + 'B1'

// parsers
let getAll = (column, row) => sheet + column + row + ':' + column
let get = (column, row) => sheet + column + row

const queries = {
    titles: getAll(titles, firstContentRow),
    links: getAll(urls, firstContentRow),
    tags: getAll(tags, firstContentRow),
    dates: getAll(dates, firstContentRow),
    contents: getAll(contents, firstContentRow),
    posts: [getAll(titles, firstContentRow), getAll(urls, firstContentRow), getAll(tags, firstContentRow), getAll(dates, firstContentRow), lastEdit],
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
        console.log('building batch query')
        let ranges = ''
        query.map((range, index) => (index === 0) ? ranges += 'ranges=' + range : ranges += '&ranges=' + range)
        let url = base + sheetid + '/values:batchGet?' + ranges + '&key=' + apikey
        console.log(url)
        resolve(url)
    }
    else {
        console.log('building single query')
        let url = base + sheetid + '/values/' + query + '?key=' + apikey
        console.log(url)
        resolve(url)
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
            result.lastEdit = query.valueRanges[4].values
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
    console.log(blog)
    resolve(blog)

})

const buildRoutes = async (result) => new Promise((resolve, reject) => {
    let routes = {}
    result.lastEdit = routes.lastEdit
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
        // get a post
        if (typeof path === 'number') {
            let post = get(contents, path)
            checkCache(path.toString())
                .then(posts => {
                    console.log('found post in cache')
                    resolve(posts.post)})
                .catch(err => {
                    console.log(err)
                    buildQuery(post)
                        .then(url => getQuery(url))
                        .then(query => parseQuery(query))
                        .then(result => {
                            let storePost = {}
                            storePost.post = result.post
                            storePost.lastEdit = result.lastEdit
                            console.log('saving post')
                            window.localStorage.setItem(path.toString(), JSON.stringify(storePost))
                            resolve(result.post)
                        })
                        .catch(err => reject(err))
                })

        }
        else {
            resolve(path)
        }
    })
}


const checkCache = (name) => new Promise((resolve, reject) => {
    let localItem = window.localStorage.getItem(name)
    if (!localItem) {
        reject('No local ' + name + ' found')
    } else {
        buildQuery(lastEdit)
            .then(url => getQuery(url))
            .then(result => {
                let serverTime = parseInt(result.values[0][0])
                console.log('Last Edit: ' + serverTime)
                if (typeof serverTime !== 'number') {
                    reject('invalid lastEdit')
                }
                else {
                    let foundItem = JSON.parse(localItem)
                    if (serverTime > foundItem.lastEdit) {
                        // window.localStorage.clear()
                        window.localStorage.removeItem(name)
                        reject('local item old, get new one')
                    }
                    else {
                        resolve(foundItem)
                    }
                }
            })
    }
})

const renderRoutes = (routes) => {
    window.onpopstate = () => {
        followRoute(routes)
            .then(route => content.innerHTML = route)
            .catch(err => content.innerHTML = err) // TODO: retry fetch
    }
    followRoute(routes)
        .then(route => content.innerHTML = route)
        .catch(err => content.innerHTML = err) // TODO: retry fetch
}

const buildSite = async () => {
    checkCache('routes')
        .then(routes => {
            console.log('found routes in cache')
            console.log(routes)
            renderRoutes(routes)
        })
        .catch(err => {
            console.log(err)
            // get from cms
            buildQuery(queries.posts)
                .then(url => getQuery(url))
                .then(query => parseQuery(query))
                .then(result => buildRoutes(result))
                .then(routes => {
                    console.log('getting routes from cms')
                    console.log(routes)
                    renderRoutes(routes)
                    console.log('caching routes')
                    window.localStorage.setItem('routes', JSON.stringify(routes))
                    resolve(routes)
                })
                .catch(err => console.log(err))
        })


}
buildSite()