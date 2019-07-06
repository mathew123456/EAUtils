# EAUtils
Einstein Analytics Utilities

Requires node/ npm

This command line utility peforms various functions to an EA dataflow json file

Possible parameters;
{ name: 'sourceFile', alias: 's', type: String }  
{ name: 'destFile', alias: 'd', type: String }  
{ name: 'datasetName', alias: 'n', type: String }  
{ name: 'prefix', alias: 'f', type: String }  
{ name: 'listDatasets', alias: 'l', type: Boolean}  
{ name: 'renameDataset', alias: 'r', type: Boolean}  
{ name: 'pruneDataset', alias: 'p', type: Boolean}  
{ name: 'extractDataset', alias: 'e', type: Boolean}  
  
To listDatasets  
    node DataflowUtil.js --listDatasets --sourceFile "[source]"   

To prune a specific dataset OUT from source file to dest file  
    node DataflowUtil.js --pruneDataset --sourceFile "[source]" --datasetName --destFile "[dest]"  
  
To rename all the entities (with a prefix) that lead to a dataset read from source file and renaming to dest file  
    node DataflowUtil.js --renameDataset --sourceFile "[source]" --datasetName --prefix "prefix" --destFile "[dest]"  
  
To extract all the entities that lead to a dataset read from source file and saving to dest file, ie, write out one chain/ flow  
    node DataflowUtil.js --extractDataset --sourceFile "[source]" --datasetName --destFile "[dest]"  