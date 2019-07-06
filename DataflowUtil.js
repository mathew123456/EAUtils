var fs = require('fs');
var path = require('path');


const optionDefinitions = [
    { name: 'sourceFile', alias: 's', type: String },
    { name: 'destFile', alias: 'd', type: String },
    { name: 'datasetName', alias: 'n', type: String },
    { name: 'prefix', alias: 'f', type: String },
    { name: 'listDatasets', alias: 'l', type: Boolean},
    { name: 'renameDataset', alias: 'r', type: Boolean},
    { name: 'pruneDataset', alias: 'p', type: Boolean},
    { name: 'extractDataset', alias: 'e', type: Boolean}
  ]


function processFile(sourceFile, entities, flows) {
    console.log('Processing ' + sourceFile);

    
    let temp = fs.readFileSync(sourceFile, 'utf8');


    let entryMap = [];
    let FileEntityList = []

    var entries = JSON.parse(temp)

    Object.assign(entities, entries)

    if (!Object.keys(entities).length) {
        console.log('--> Nothing to do..');
        return;
    }
    for (var entry in entities) {
        let action = entities[entry].action;
        FileEntityList.push(entry)

        let source, datasetName, details = null
        switch (action) {
            case 'sfdcRegister':
                source = [entities[entry].parameters.source];
                details = '[' + entities[entry].parameters.name + ']';
                datasetName = entities[entry].parameters.name;
                break;
            case 'augment':
                source = [entities[entry].parameters.left, entities[entry].parameters.right];
                details = '[' + (entities[entry].parameters.operation ? entities[entry].parameters.operation : 'LookupSingleValue') + ']';
                break;
            case 'sfdcDigest':
                source = null;
                details = '[' + entities[entry].parameters.object + ']';
                break;
            case 'computeExpression':
                source = [entities[entry].parameters.source];
                details = '<ul>';
                Object.entries(entities[entry].parameters.computedFields).forEach(([key, field]) => {
                    details += '<li>' + field.name + '</li>'
                });
                details += '</ul>';

                break;
            case 'filter':
                source = [entities[entry].parameters.source];
                details = '[' + (!entities[entry].parameters.filter ? entities[entry].parameters.saqlFilter : entities[entry].parameters.filter).replace(/\"/gi, '#quot;') + ']';
                break;
            case 'sliceDataset':
                source = [entities[entry].parameters.source];
                details = entities[entry].parameters.mode + '<ul>';
                Object.entries(entities[entry].parameters.fields).forEach(([key, value]) => { details += '<li>' + value.name + '</li>'; })
                details += '</ul>';
                break;
            case 'append':
                source = entities[entry].parameters.sources;
                if (entities[entry].parameters.enableDisjointedSchemaMerge)
                    details = '[enableDisjointedSchemaMerge]';
                break;
            case 'edgemart':
                details = '[' + entities[entry].parameters.alias + ']';
                source = null;
                break;
            case 'flatten':
                source = [entities[entry].parameters.source];
                details = entities[entry].parameters.multi_field;
                break;
            case 'computeRelative':
                source = [entities[entry].parameters.source];
                break;
        }

        entryMap.push({ 'name': entry, 'action': action, 'source': source, 'dataset': datasetName, 'details': details });

    }
    //console.log(entryMap)


    // each 'flow' ends with a register

    let colNum = 0;

    // FILTERED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  && x.name == 'register_DS - DEV - CALMS - Agreements_0'
    Object.entries(entryMap.filter(x => x.action == 'sfdcRegister')).forEach(
        ([key, value]) => {
            value.col = colNum;
            value.row = 0;
            value.processed = false;


            flows.push({ 'name': value.dataset, 'definition': [value], 'graph': '' });
        }
    );


    

    


    Object.entries(flows).forEach(
        ([flowKey, flow]) => {
            let doLoop = true;
            while (doLoop) {

                if (flow.definition.filter(x => x.processed == false).length == 0) {
                    doLoop = false;
                }

                // get all 'unprocessed' entries
                Object.entries(flow.definition.filter(x => x.processed == false)).forEach(([flowItemKey, flowItem]) => {
                    // console.log(flowItem)
                    // add all the 'sources'
                    if (flowItem.source != null) {
                        Object.entries(flowItem.source).forEach(([sourceItemKey, sourceItem]) => {
                            // console.log(sourceItem)
                            let sourceEntry = entryMap.filter(x => x.name == sourceItem)[0];

                            sourceEntry.processed = false;

                            // check if the definition already includes the item
                            if (flow.definition.filter(x => x.name == sourceEntry.name).length == 0)
                                flow.definition.unshift(sourceEntry);
                        });
                    }
                    flowItem.processed = true;
                });


            }

        }
    );
    colNum++;

    //***************************************************************************** */

    // now we have processed flow, clean it up!
    Object.entries(flows).forEach(
    ([flowKey, flow]) => {
        var entityList = []
        Object.entries(flow.definition).forEach(([defKey, defItem]) => {
            entityList.push(defItem.name)
        })
        flow["entityList"] = entityList
    })

}


function renameDataflow(filename, datasetName, newName, outputFilename) { 
    let entries = {}
    let flows = []
    processFile(filename, entries, flows)

    // go through and check if each entity is used anywhere else - so we can delete!!
    // DELETE!!!!
    
    var flowToProcess = flows.filter(x => x.name == datasetName)[0]
    //console.log(flowToProcess)

    // go through each entity in flow and check if being used in another flow
    let entityCopy = {}


    Object.entries(entries).forEach(([key, value]) => {
        var newKey = key
        if(flowToProcess.entityList.includes(key)) {
            newKey = newName + key
            console.log(`--> Renaming ${key} to ${newKey}`)
        }

        // we need to double check for the source parameter
        var newValue = value
        if(value.parameters.hasOwnProperty('source') && flowToProcess.entityList.includes(value.parameters.source)) {
            newValue.parameters.source = newName + value.parameters.source
        }

        entityCopy[newKey] = newValue
    })

    fs.writeFileSync(outputFilename, JSON.stringify(entityCopy))

    console.log(`Finshed renaming and wrote to ${outputFilename}`)

}

function pruneDataset(filename, datasetName, outputFilename) { 
    let entries = []
    let flows = []
    processFile(filename, entries, flows)

    // go through and check if each entity is used anywhere else - so we can delete!!
    // DELETE!!!!
    

    var deleteList = []
    var flowToProcess = flows.filter(x => x.name == datasetName)[0]


    // go through each entity in flow and check if being used in another flow
    let entityCopy = {}

    Object.entries(flowToProcess.entityList).forEach(([i, entity]) => {
        var found = false
        Object.entries(flows.filter(x => x.name != datasetName)).forEach(
            ([flowKey, flow]) => {
                
                Object.entries(flow.definition).forEach(([defKey, defItem]) => {
                    if(entity == defItem.name) {
                        found = true
                    }
                })
            })
        if(!found) {
            deleteList.push(entity)
        }
    })

    Object.entries(entries).forEach(([key, value]) => {
        if(!deleteList.includes(key)) {
            entityCopy[key] = value
        }
    })

    fs.writeFileSync(outputFilename, JSON.stringify(entityCopy))

    console.log(`Removed ${deleteList.length} entities and wrote to ${outputFilename}`)


}

function extractDataset(filename, datasetName, outputFilename) { 
    let entries = []
    let flows = []
    processFile(filename, entries, flows)


    var flowToProcess = flows.filter(x => x.name == datasetName)[0]


    // go through each entity in flow and check if being used in another flow
    let entityCopy = {}



    Object.entries(entries).forEach(([key, value]) => {
        if(flowToProcess.entityList.includes(key)) {
            entityCopy[key] = value
        }
    })

    fs.writeFileSync(outputFilename, JSON.stringify(entityCopy))

    console.log(`Exracted ${flowToProcess.entityList.length} entities and wrote to ${outputFilename}`)


}

function listDatasets(filename) {
    let entries = {}
    let flows = []
    processFile(filename, entries, flows)

    console.log('Datasets;')
    Object.entries(flows).forEach(([key, value]) => {console.log('   > ' + value.name)})
}



function handleCLI() {
    const commandLineArgs = require('command-line-args')
    const options = commandLineArgs(optionDefinitions)

    var isValid = false
    if(Object.keys(options).length == 0){
        displayHelp(false)
    } else {
        var sourceFileSpecified = options.hasOwnProperty('sourceFile')

        var listFunction = options.hasOwnProperty('listDatasets')
        var pruneFunction = options.hasOwnProperty('pruneDataset')
        var extractFunction = options.hasOwnProperty('extractDataset')
        var renameFunction = options.hasOwnProperty('renameDataset')

        var prefixSpecified = options.hasOwnProperty('prefix')
        var datasetSpecified = options.hasOwnProperty('datasetName')
        var destFileSpecified = options.hasOwnProperty('destFile')

        if(!sourceFileSpecified) {
            console.log('You must specify a source file')
        }

        if(listFunction && sourceFileSpecified) {
            listDatasets(options.sourceFile)
        } else if (pruneFunction && sourceFileSpecified && datasetSpecified && destFileSpecified){
            pruneDataset(options.sourceFile, options.datasetName, options.destFile)
        } else if (renameFunction && sourceFileSpecified && datasetSpecified && prefixSpecified && destFileSpecified) {
            renameDataflow(options.sourceFile, options.datasetName, options.prefix, options.destFile)
        } else if (extractFunction && sourceFileSpecified && datasetSpecified && destFileSpecified) {
            extractDataset(options.sourceFile, options.datasetName, options.destFile)
        }  else {
            displayHelp(true)
        }

    }
    

}

function displayHelp(error) {
    if(error)
        console.log('Parameters incorrectly specified')
    console.log('This util peforms various functions to an EA dataflow json file')  

    console.log(`

Possible parameters;
{ name: 'sourceFile', alias: 's', type: String },
{ name: 'destFile', alias: 'd', type: String },
{ name: 'datasetName', alias: 'n', type: String },
{ name: 'prefix', alias: 'f', type: String },
{ name: 'listDatasets', alias: 'l', type: Boolean},
{ name: 'renameDataset', alias: 'r', type: Boolean},
{ name: 'pruneDataset', alias: 'p', type: Boolean},
{ name: 'extractDataset', alias: 'e', type: Boolean}

To listDatasets
    node DataflowUtil.js --listDatasets --sourceFile "[source]"

To prune a specific dataset OUT from source file to dest file
    node DataflowUtil.js --pruneDataset --sourceFile "[source]" --datasetName "[dataset]" --destFile "[dest]"

To rename all the entities (with a prefix) that lead to a dataset read from source file and renaming to dest file
    node DataflowUtil.js --renameDataset --sourceFile "[source]" --datasetName "[dataset]" --prefix "prefix" --destFile "[dest]"

To extract all the entities that lead to a dataset read from source file and saving to dest file, ie, write out one chain/ flow
    node DataflowUtil.js --extractDataset --sourceFile "[source]" --datasetName "[dataset]" --destFile "[dest]"
    
    `)
     
}


handleCLI()

