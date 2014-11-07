process.env.NODE_ENV = 'production';

var Pageres = require('pageres');
var nodeNote = require('node-note');
var config = require('./config.json');

var evernote = new nodeNote(config);

evernote.getNoteMetadata({word: 'web_design_evernote'}, function (noteMetadataList) {
  var guid = noteMetadataList[0].guid;
  evernote.getNote({guid: guid, withContent: true}, function (note) {
    console.log(note.title);
    console.log(note.content);
  });
});


// // get url from evernote.
// var url = 'http://www.waseda.jp/top/';
//
// // get screen shot
// var pageres = new Pageres({delay: 2})
//   .src(url, ['iphone 5s', '1024x768', '1920x1120'])
//   .dest(__dirname + '/images');
//
// pageres.run(function (err) {
//   if (err) throw err;
//   console.log('done');
// });
//
// // create new note
