process.env.NODE_ENV = 'production';

var Pageres = require('pageres');
var nodeNote = require('node-note');
var cheerio = require('cheerio');
var config = require('./config.json');

var evernote = new nodeNote(config);

function getUrl (callback) {
  evernote.getNoteMetadata({word: 'web_design_evernote'}, function (noteMetadataList) {
    var guid = noteMetadataList[0].guid;
    evernote.getNote({guid: guid, withContent: true}, function (note) {
      var $ = cheerio.load(note.content);
      var url = $('a').attr('shape', 'rect').first().text();
      console.log('URL:', url);
      callback(url);
    });
  });
}

function getPage (url) {
  var pageres = new Pageres({delay: 2})
    .src(url, ['iphone 5s', '1024x768', '1920x1120'])
    .dest(__dirname + '/images');

  pageres.run(function (err) {
    if (err) throw err;
    console.log(url + ', done.');
  });
}

getUrl(function (url) {
  getPage(url);
});
