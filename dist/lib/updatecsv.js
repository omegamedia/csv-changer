'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const es = require('event-stream');
const writeFile = require('./file').writeFile;
/**
 * Create array of header values
 * @param str First line of csv
 * @param delimiter csv delimiter
 */
const getHeader = (str, delimiter = ',') => str.split(delimiter);
const matchMultipleIndexes = (array, indexes) => indexes.map(index => array.reduce(matchNameGetIndex(index || ""), 0));
const matchNameGetIndex = (value) => (index, name, i) => value == name.replace(/"/g, "").replace(/'/g, "") ? i : index;
/**
 * Create line without modifications
 * In use for consistency
 * @param str First line of csv
 * @param delimiter csv delimiter
 */
const createSimpleLine = (str, delimiter = ',', excel = false, quotes = true) => {
    let array = str.split(delimiter);
    let newstring = array.reduce(createLineFromArr(delimiter, excel, quotes), '');
    return newstring;
};
/**
 *
 * @param excel bool to use format for excel or regular
 * @param delimiter delimiter
 * @param string line
 * @param value current value in array
 * @param i index
 * @param original original array
 */
const createLineFromArr = (delimiter = ',', excel = false, quotes = true) => (string, value, i, original) => {
    const wrap = (str) => {
        if (excel) {
            return `"=""${str.replace(/"/g, "")}"""`;
        }
        else {
            return quotes ? `"${str.replace(/"/g, "")}"` : `${str.replace(/"/g, "")}`;
        }
    };
    if (i === original.length - 1) {
        string += `${wrap(value)}\n`;
    }
    else {
        string += `${wrap(value)};`;
    }
    return string;
};
/**
 * Modify line
 * @param str Line from original csv
 * @param options config options
 */
const createNewLine = (str, options, constants) => {
    let delimiter = options.delimiter || ',';
    let type = options.type;
    let arr = str.split(delimiter);
    let newline = str;
    if (type === "move_inside") {
        newline = move_inside(arr, options, constants);
    }
    return newline;
};
/**
 * Get constant variables needed for file transformation
 * @param str First line
 * @param options config options
 */
const createConstants = (str, options) => {
    let delimiter = options.delimiter || ',';
    let array = str.split(delimiter);
    let constants = {};
    if (options.type === "move_inside" /*&& checkOptions("move_inside", options)*/) {
        // Type move_inside = move variable from inside kolumn to new kolumn
        /* TODO: only yet supported type */
        constants = {
            indexA: array.reduce(matchNameGetIndex(options.options.columnA || ""), 0),
            indexB: array.reduce(matchNameGetIndex(options.options.columnB || ""), 0),
            multipleIndexes: matchMultipleIndexes(array, options.options.columnsA || [])
        };
    }
    return constants;
};
/**
 * Main func
 * Update csv file
 */
const main = (options) => new Promise((resolve, reject) => {
    let newfilename = options.newfilename || `${options.filename}_new.csv`;
    let index = 0;
    let newstring = '';
    let header = [];
    let constants = {};
    let path = `${options.path}${options.filename}`;
    try {
        let s = fs.createReadStream(path)
            .pipe(es.split())
            .pipe(es.mapSync((line) => {
            s.pause();
            /* If first line */
            if (index === 0) {
                newstring += createSimpleLine(line, options.delimiter, options.excel, options.quotes);
                header = getHeader(line, options.delimiter);
                constants = createConstants(line, options);
            }
            else {
                /*  Create new lines */
                newstring += createNewLine(line, options, constants);
            }
            index++;
            s.resume();
        }))
            .on('error', (err) => {
            reject({
                ok: false,
                message: "Something went wrong",
                err: err
            });
        })
            .on('end', () => {
            writeFile(newstring, options.newfilename, options.path)
                .then((success) => resolve(success))
                .catch((err) => reject(err));
        });
    }
    catch (err) {
        reject({
            ok: false,
            message: "something went wrong",
            err: err
        });
    }
});
/* Down here is all the types */
/**
 * Used when you want to move a value from inside a column to another column
 * @param arr from line
 * @param options user options
 * @param constants constants created from first line
 */
const move_inside = (arr, options, constants) => {
    /* Possible error, need fix */
    let func = (str) => str;
    if (typeof options.options.findValue === 'function') {
        func = options.options.findValue;
    }
    let foundValue = "";
    // Check first for multiple indexes
    if (constants.multipleIndexes) {
        let value = constants.multipleIndexes.map(i => func(arr[i])).filter(index => index !== "")[0] || "";
        if (value !== "") {
            foundValue = value;
        }
    }
    else if (constants.indexA) {
        if (arr[constants.indexA]) {
            foundValue = func(arr[constants.indexA]);
        }
    }
    if (constants.indexB) {
        if (arr[constants.indexB]) {
            arr[constants.indexB] = foundValue;
        }
    }
    return arr.reduce(createLineFromArr(options.delimiter, options.excel, options.quotes), '');
};
/**
 * Check if type has all the options required
 */
const checkOptions = (type, options) => {
    let check = false;
    if (type === "move_inside") {
        check = options.options.findValue &&
            (options.options.columnA || options.options.indexA) &&
            (options.options.columnB || options.options.indexB) ?
            true : false;
    }
    if (!check) {
        console.log('Missing options | csv-changer');
    }
    return check;
};
exports.main = main;
