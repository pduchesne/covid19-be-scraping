const fetch = require('node-fetch');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const COOKIE = "<YOUR COOKIE HERE>";
const XSRF_TOKEN = "<YOUR XSRF TOKEN HERE>";

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
 * Create a Province Daily Cases request
 * @param date
 */
const createProvinceRequest = function(date)
{
    return {
      "requestContext": {
        "reportContext": {
          "reportId": "c14a5cfc-cab7-4812-848c-0369173148ab",
          "pageId": "17170155",
          "mode": "VIEW",
          "componentId": "cd-ekde89p46b"
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
            "name": "qt_zh8gbaq46b",
            "datasetNs": "d0",
            "tableNs": "t0",
            "dataTransformation": {
              "sourceFieldName": "_n987485392_"
            }
          },
          {
            "name": "qt_1icd89p46b",
            "datasetNs": "d0",
            "tableNs": "t0",
            "dataTransformation": {
              "sourceFieldName": "datastudio_record_count_system_field_id_98323387"
            }
          }
        ],
        "sortData": [
          {
            "sortColumn": {
              "name": "qt_1icd89p46b",
              "datasetNs": "d0",
              "tableNs": "t0",
              "dataTransformation": {
                "sourceFieldName": "datastudio_record_count_system_field_id_98323387"
              }
            },
            "sortDir": 1
          }
        ],
        "includeRowsCount": true,

        "blendConfig": {
          "blockDatasource": {
            "datasourceBlock": {
              "id": "block_qk4n5k946b",
              "type": 1,
              "inputBlockIds": [],
              "outputBlockIds": [],
              "fields": []
            },
            "blocks": [
              {
                "id": "block_rk4n5k946b",
                "type": 5,
                "inputBlockIds": [],
                "outputBlockIds": [],
                "fields": [],
                "queryBlockConfig": {
                  "joinQueryConfig": {
                    "joinKeys": [],
                    "queries": [
                      {
                        "datasourceId": "41efbf00-b938-4f99-80a8-da1f1cc87a36",
                        "concepts": []
                      }
                    ]
                  }
                }
              }
            ],
            "delegatedAccessEnabled": true,
            "isUnlocked": true,
            "isCacheable": false
          }
        },
        "filters": [],
        "features": [],
        "dateRanges": [
          {
            "startDate": formatDate(date),
            "endDate": formatDate(date),
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
              "sourceFieldName": "_n173995999_"
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
                    rawText = rawText.substring(5);
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
    )
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
 * Returns daily cases per province for a given day, in the form {timestamp: <date>, [<province_name> : <count>]* }
 * @param fromDate
 * @param toDate
 * @return {PromiseLike<any> | Promise<any>}
 */
const retrieveProvinceDataForDate = function(date) {

    console.log('Retrieving province daily cases for '+date);

    const provinceRequest = createProvinceRequest(date);

    const request = createDataStudioRequest([provinceRequest]);

    //console.log(JSON.stringify(request, undefined, 4));
    return processRequest(request)
        .then(results => {
            const result = {timestamp: new Date(date.getTime()).toISOString()};

            if (results.tableDataset.column.length == 0) {
                // no data this day
                return result;
            }

            const provinceNames = results.tableDataset.column[0].stringColumn.values;
            const values = results.tableDataset.column[1].longColumn.values;

            provinceNames.forEach( (name, idx) => result[name] = values[idx] )

            return result;
        })
}

/**
 * Returns whole history of daily cases per province in the form {timestamp: <date>, [<province_name> : <count>]* }
 * @return {PromiseLike<any> | Promise<any>}
 */
const retrieveFullProvinceHistory = async function() {
    const provinceHistory = [];

    var now = new Date();
    for (var d = new Date("2020-02-8"); d <= now; d.setDate(d.getDate() + 1)) {
        await retrieveProvinceDataForDate(d).then(
            data => provinceHistory.push(data)
        )
    }

    return provinceHistory;
}


// Retrieve whole province daily cases history and dump it into a csv file
retrieveFullProvinceHistory().then(history => {
    const fieldNames = {};
    // browse through all records to fetch all column names - quick & dirty
    history.forEach(record => Object.keys(record).forEach(fieldName => fieldNames[fieldName] = fieldName))

    const csvHeaders = Object.keys(fieldNames).map(name => ({id: name, title:name}) );

    const csvWriter = createCsvWriter({
        path: 'extracts/provincesDailyCases.csv',
        header: csvHeaders
    });
    csvWriter.writeRecords(history)
        .then(() => {
            console.log('...Done');
        });
})







