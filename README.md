# covid-scrape

This project aims at extracting COVID19 belgian data from the Sciensano data residing in Google DataStudio.
This code is a very rough and naive attempt at interfacing with DataStudio, but the objective is data availability, 
not code reusability.

Data extracts will be performed regularly, and committed in this source tree, in `./extracts` .

## The data

Currently this code only extracts the whole history of daily cases per province.

## Running extracts

The DataStudio API requires Google authentication to access data.  
As a result, before running this code, you must access the dashboard in your browser (https://datastudio.google.com/u/0/reporting/c14a5cfc-cab7-4812-848c-0369173148ab/page/9tCKB),
open your network debugger, look for a `https://datastudio.google.com/u/0/batchedDataV2?` request and copy the values of
the `Cookie` and `x-rap-xsrf-token` headers.  

These values must then be set in the `COOKIE` and `XSRF-TOKEN` constants at the beginning of `src/index.js` .

Code can then be run using Node :
```
$> npm install      # first install dependencies
$> npm run extract  # do the actual extract
```

## License
This source code is open and licensed under the MIT license.

While being done in good faith and with best efforts, this source code and the data it produces are provided "as is", 
with no warranty of accuracy, completeness, or usefulness.  
The author shall not be held liable for misuse or damage resulting from the use of this data. 

This project relies on data extracted from the Sciensano portal.
As per the Sciensano license conditions, all data extracted or derived from Sciensano are free to reuse on the sole condition of 
mentioning the source:

> « QUOILIN, Sophie, LEROY Mathias, DUPONT Yves. Epistat, Covid19 ), Sciensano, Brussels, Belgium, https://epistat.wiv-isp.be/covid/. »  
> Sciensano is not responsible for the conclusions drawn on the basis of these data.