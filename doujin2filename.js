const path = require('path');
const fs = require('fs');
const _ = require('lodash');
require('colors');  // コンソール色付け
const jsdiff = require('diff');

const ROOT_DIRECTORY = path.resolve('./');

// カレントディレクトリのディレクトリを列挙
const directories = _(fs.readdirSync(ROOT_DIRECTORY))
  .filter(name => fs.statSync(path.join(ROOT_DIRECTORY, name)).isDirectory())
  .value();

const notBooks = [];  // 本じゃないディレクトリ
const notImages = {}; // 画像ファイルじゃないもの（ディレクトリ含む）
const deleteFiles = {}; // 自動削除されるファイル

let numOfRenameDirectories = 0;
let numOfNotRenameDirectories = 0;
let numOfRenameFiles = 0;
let numOfNotRenameFiles = 0;

directories.forEach(directoryName => {
  const absDirectoryPath = path.join(ROOT_DIRECTORY, directoryName);

  //-----------------------------   event     author   title  original    suffix
  const match = directoryName.match(/^(\(.+\) *)?([\[【].+?[\]】]) *(.+?)( *\(.+\))?( *\[.+\])?$/);
  if (!match) {
    // 本じゃない
    notBooks.push(directoryName);
    return;
  }
  const event = _.trim(match[1]).replace(/\(同人誌\)|\(同人CG集\)|\(成年コミック\)/g, '').trim();
  const author = _.trim(match[2]).replace('【', '[').replace('】', ']').trim();
  const title = _.trim(match[3]);
  const original = _.trim(match[4]).replace(/\(オリジナル\)/g, '').trim();
  const suffix = _.trim(match[5]);

  // 正規化した新しいディレクトリ名
  const newDirectoryName = _.compact([
    event,
    author,
    title,
    original,
    suffix,
  ]).join(' ');
  if (directoryName !== newDirectoryName) {
    const diff = jsdiff.diffChars(directoryName, newDirectoryName);
    const diffStr = diff.reduce((str, d) => {
      if (!d.added && !d.removed) str += d.value;
      if (d.removed) str += d.value.red;
      if (d.added) str += d.value.green;
      return str;
    }, '');
    console.log(diffStr);
  } else {
    console.log(newDirectoryName);
  }

  // 画像ファイルの更新日時をディレクトリの更新日時にする
  const lastModified = fs.statSync(absDirectoryPath).ctime;

  // ディレクトリ内の画像ファイルを列挙
  const files = _(fs.readdirSync(absDirectoryPath));
  const notImagesOf = [];
  const deleteFilesOf = [];
  files.forEach(fileName => {
    const absFilePath = path.join(ROOT_DIRECTORY, directoryName, fileName);

    // ディレクトリは対象外
    if (fs.statSync(absFilePath).isDirectory()) {
      notImagesOf.push(fileName + '\\'.bgRed);
      return;
    }
    // Thumbs.dbを削除する
    if (fileName === 'Thumbs.db') {
      deleteFilesOf.push(fileName.red);
      fs.unlinkSync(absFilePath);
      return;
    }
    // 画像ファイル以外は対象外
    if (!/\.(jpg|jpeg|png|gif)$/i.test(fileName)) {
      // 拡張子部分を赤くする
      notImagesOf.push(fileName.replace(/\.([A-Za-z]+)$/, match => match.bgRed));
      return;
    }

    // 画像ファイルの更新日時をディレクトリの更新日時にする
    fs.utimesSync(absFilePath, lastModified, lastModified);

    // 画像ファイルをリネーム
    const newFileName = `${title}_${fileName}`;
    if (fileName.includes(title)) {
      console.log(`"${fileName}" already includes "${title}"`.yellow);
      numOfNotRenameFiles++;
    } else {
      fs.renameSync(absFilePath, path.join(ROOT_DIRECTORY, directoryName, newFileName));
      numOfRenameFiles++;
    }
  });
  if (0 < notImagesOf.length) notImages[directoryName] = notImagesOf;
  if (0 < deleteFilesOf.length) deleteFiles[directoryName] = deleteFilesOf;

  // 最後にディレクトリをリネーム
  if (directoryName !== newDirectoryName) {
    fs.renameSync(absDirectoryPath, path.join(ROOT_DIRECTORY, newDirectoryName));
    numOfRenameDirectories++;
  } else {
    numOfNotRenameDirectories++;
  }
});

console.log(`---------- Books (${_.size(directories)} directories)----------`.green);
console.log(`  Directory : ${ROOT_DIRECTORY}`.green);
console.log(`  Rename    : ${numOfRenameDirectories} directories`.green);
console.log(`  Not Rename: ${numOfNotRenameDirectories} directories`.green);
console.log(`  Rename    : ${numOfRenameFiles} files`.green);
console.log(`  Not Rename: ${numOfNotRenameFiles} files`.green);

if (!_.isEmpty(notBooks)) {
  console.log(`---------- Not Books (${_.size(notBooks)} directories)----------`.yellow);
  _.forEach(notBooks, directoryName => console.log(directoryName.red));
}
if (!_.isEmpty(notImages)) {
  console.log(`---------- Not Images (${_.size(notImages)} directories)----------`.yellow);
  _.forEach(notImages, (names, directoryName) => {
    console.log(directoryName.red);
    names.forEach(name => console.log('    ' + name));
  });
}
if (!_.isEmpty(deleteFiles)) {
  console.log(`---------- Auto Deleted Files (${_.size(deleteFiles)} directories)----------`.yellow);
  _.forEach(deleteFiles, (names, directoryName) => {
    console.log(directoryName.red);
    names.forEach(name => console.log('    ' + name));
  });
}
