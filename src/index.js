const fetch = require('node-fetch');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const COOKIE = "<YOUR COOKIE HERE>";
const XSRF_TOKEN = "<YOUR XSRF TOKEN HERE>";


// list of "report components" that expose fields below
const DS_REPORTS_COMPONENTS = {
    "province" : "cd-ekde89p46b",
    "gender" : "cd-lu4je9p46b",
    "age" : "cd-97aeueq46b",
    "totalCases" : "cd-vxmmq3q46b"
}

const DS_FIELDS = {
    "cases" : "datastudio_record_count_system_field_id_98323387",
    "timestamp" : "_n173995999_",
    "province" : "_n987485392_",
    "gender" : "_n1249512767_",
    "age" : "calc_nfwpvhq46b"
}

// The DataStudio API endpoint
const URL = "https://datastudio.google.com/u/0/batchedDataV2?appVersion=20200325_00020000";

const headers = {
    "Content-Type": "application/json",
    "Accept" : "application/json, text/plain, */*",
    "Cookie" : COOKIE,
    "x-rap-xsrf-token" : XSRF_TOKEN
};


/**
 * Create a DataStudio request from multiple data requests
 * @param requests
 * @return {{dataRequest: *}}
 */
const createDataStudioRequest = function(requests) {
    return {
        "dataRequest": requests
    }
}


/**
 * Create a Daily Cases request for a given field
 * @param date
 */
const createFieldRequest = function(fromDate, toDate, field)
{
    return {
      "requestContext": {
        "reportContext": {
          "reportId": "c14a5cfc-cab7-4812-848c-0369173148ab",
          "pageId": "17170155",
          "mode": "VIEW",
          "componentId": DS_REPORTS_COMPONENTS[field]
        }
      },
      "datasetSpec": {
        "dataset": [
          {
            "datasourceId": "41efbf00-b938-4f99-80a8-da1f1cc87a36",
            "revisionNumber": 0
          }
        ],
        "queryFields": [
          {
            "name": "field1",
            "datasetNs": "d0",
            "tableNs": "t0",
            "dataTransformation": {
              "sourceFieldName": DS_FIELDS[field]
            }
          },
          {
            "name": "field2",
            "datasetNs": "d0",
            "tableNs": "t0",
            "dataTransformation": {
              "sourceFieldName": DS_FIELDS["cases"]
            }
          }
        ],
        "includeRowsCount": true,
        "filters": [],
        "features": [],
        "dateRanges": [
          {
            "startDate": formatDate(fromDate),
            "endDate": formatDate(toDate),
            "dataSubsetNs": {
              "datasetNs": "d0",
              "tableNs": "t0",
              "contextNs": "c0"
            }
          }
        ],
        "contextNsCount": 1,
        "dateRangeDimensions": [
          {
            "name": "qt_qwryafq46b",
            "datasetNs": "d0",
            "tableNs": "t0",
            "dataTransformation": {
              "sourceFieldName": DS_FIELDS['timestamp']
            }
          }
        ],
        "calculatedField": [],
        "needGeocoding": false,
        "geoFieldMask": []
      },
      "useDataColumn": true
    }
}

const processRequest = function(request) {
    return fetch(URL, {method: 'POST', body: JSON.stringify(request), headers : headers}).then(
        resp => {
            return resp.text().then(rawText => {
                if (rawText.startsWith(")]}',")) {
                    rawText = rawText.substring(5);
                } else if (rawText.startsWith(")]}")) {
                    rawText = rawText.substring(3);
                }

                return JSON.parse(rawText);
            });

        }
    ).then(
        jsonObj => {
            if (jsonObj.errorStatus) {
                throw `Failed request (${jsonObj.reason}): ${jsonObj.errorStatus.reasonStr}`;
            } else if (jsonObj.default) {
                if (jsonObj.default.dataResponse[0].errorStatus) {
                    throw "DataResponse error: "+jsonObj.default.dataResponse[0].errorStatus.reasonStr
                }
                return jsonObj.default.dataResponse[0].dataSubset[0].dataset
            } else {
                throw "Unexpected response : "+JSON.stringify(jsonObj)
            }
        }
    ).catch(err => {
        console.warn("Failed request : "+JSON.stringify(request, undefined, 4));
        throw err;
    })
}

/**
 * format date as expected by DataStudio, i.e. YYYMMDD
 * @param date
 * @return {string}
 */
const formatDate = function(date) {
    var mm = date.getMonth() + 1; // getMonth() is zero-based
    var dd = date.getDate();

    return [date.getFullYear(),
        (mm>9 ? '' : '0') + mm,
        (dd>9 ? '' : '0') + dd
    ].join('');
}

/**
 * Returns daily cases per 'field'' for a given day, in the form {timestamp: <date>, [<field_value> : <count>]* }
 * @param fromDate
 * @param toDate
 * @return {PromiseLike<any> | Promise<any>}
 */
const retrieveDataForDate = function(field, date) {

    console.log('Retrieving daily cases for '+field+' on '+date);

    // retrieve data on single day
    const dataRequest = createFieldRequest(date, date, field);

    const request = createDataStudioRequest([dataRequest]);

    //console.log(JSON.stringify(request, undefined, 4));
    return processRequest(request)
        .then(results => {
            const result = {timestamp: new Date(date.getTime()).toISOString()};

            if (results.tableDataset.column.length == 0) {
                // no data this day
                return result;
            }

            const dataFieldNames = results.tableDataset.column[0].stringColumn.values;
            const values = results.tableDataset.column[1].longColumn.values;

            dataFieldNames.forEach( (name, idx) => result[name] = values[idx] )

            return result;
        })
}

/**
 * Returns whole history of daily cases per 'field'' in the form {timestamp: <date>, [<field_value> : <count>]* }
 * @return {PromiseLike<any> | Promise<any>}
 */
const retrieveFullHistory = async function(field) {
    const history = [];

    var now = new Date();
    for (var d = new Date("2020-02-08"); d <= now; d.setDate(d.getDate() + 1)) {
        await retrieveDataForDate(field, d).then(
            data => history.push(data)
        )
    }

    return history;
}

const produceCsvForField = function(field) {
    // Retrieve whole  daily cases history and dump it into a csv file
    retrieveFullHistory(field).then(history => {
        const fieldNames = {};
        // browse through all records to fetch all column names - quick & dirty
        history.forEach(record => Object.keys(record).forEach(fieldName => fieldNames[fieldName] = fieldName))

        const csvHeaders = Object.keys(fieldNames).map(name => ({id: name, title:name}) );

        const csvWriter = createCsvWriter({
            path: `extracts/dailyCases-${field}.csv`,
            header: csvHeaders
        });
        csvWriter.writeRecords(history)
            .then(() => {
                console.log('...Done');
            });
    })
}

produceCsvForField("province");
produceCsvForField("age");
produceCsvForField("gender");








