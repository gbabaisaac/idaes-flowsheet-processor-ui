import React from 'react';
import {useEffect, useState, useRef, forwardRef, useImperativeHandle} from 'react';
import InputAccordion from "../../../components/InputAccordion/InputAccordion";
import {loadConfig, listConfigNames, solve} from '../../../services/output.service.js'
import {useParams} from "react-router-dom";
import {
    deleteConfig,
    updateNumberOfSubprocesses
} from '../../../services/input.service.js'
import {Button, Box, Modal, Select, Stack, TextField, Tooltip} from '@mui/material';
import {Grid, InputLabel, MenuItem, FormControl} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import {getInputs, emptyOrNullObj} from '../FlowsheetConfig';

export default function ConfigInput(props) {
    const theme = props.theme;
    let params = useParams();
    const {
        flowsheetData,
        updateFlowsheetData,
        reset,
        solveType,
        numberOfSubprocesses,
        setNumberOfSubprocesses,
        setInputsChanged
    } = props;
    const [displayData, setDisplayData] = useState({})
    const [previousConfigs, setPreviousConfigs] = useState([])
    const [configName, setConfigName] = React.useState("");
    const [openDeleteConfig, setOpenDeleteConfig] = useState(false)
    const [openErrorMessage, setOpenErrorMessage] = useState(false);
    const [disableRun, setDisableRun] = useState(false)
    const [currentNumberOfSubprocesses, setCurrentNumberOfSubprocesses] = useState(null)
    const [maxNumberOfSubprocesses, setMaxNumberOfSubprocesses] = useState(null)
    const [numberOfSubprocessesIsValid, setNumberOfSubprocessesIsValid] = useState(true)
    const runButtonRef = useRef();

    const modalStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: 'background.paper',
        border: '2px solid #000',
        boxShadow: 24,
        p: 4,
    };

    useEffect(() => {
        setDisplayData(JSON.parse(JSON.stringify(flowsheetData.inputData)))
        listConfigNames(params.id, flowsheetData.inputData.version)
            .then(response => {
                if (response.status === 200) {
                    response.json()
                        .then((data) => {
                            setPreviousConfigs(data)
                            if (data.includes(flowsheetData.name)) {
                                setConfigName(flowsheetData.name)
                            }
                        }).catch((err) => {
                        console.error("unable to get list of config names: ", err)
                    })
                } else {
                    console.error("unable to get list of config names: ", response.statusText)
                }
            })
    }, [flowsheetData.inputData]);

    useEffect(() => {
        // console.log(`setting number of subprocesses current: ${numberOfSubprocesses.current}, max: ${numberOfSubprocesses.max}`)
        setCurrentNumberOfSubprocesses(numberOfSubprocesses.current)
        setMaxNumberOfSubprocesses(numberOfSubprocesses.max)
    }, [numberOfSubprocesses])

    const handleUpdateNumberOfSubprocesses = (event) => {
        console.log('updating number of subprocesses')
        setCurrentNumberOfSubprocesses(event.target.value)
        if (isNaN(event.target.value) || event.target.value === "") {
            // NOT VALID
            setNumberOfSubprocessesIsValid(false)
        } else {
            // CHECK IF WITHIN VALID BOUNDS: [1-MAX]
            let newValue = parseInt(event.target.value)
            if (newValue > 0 && newValue <= maxNumberOfSubprocesses) {
                // CALL API TO UPDATE NUMBER OF SUBPROCESSES
                updateNumberOfSubprocesses({value: newValue})
                    .then(response => response.json())
                    .then((data) => {
                        console.log('successfully updated number of subprocesses')
                        console.log(data)
                        setNumberOfSubprocesses({
                            current: data.new_value,
                            max: maxNumberOfSubprocesses
                        })
                    }).catch((e) => {
                    console.error('unable to update number of subprocesses')
                    console.error(e)
                })
                setNumberOfSubprocessesIsValid(true)
            } else {
                setNumberOfSubprocessesIsValid(false)
            }
        }
    }

    const handleConfigSelection = (event) => {
        const {
            target: {value},
        } = event;

        loadConfig(params.id, value)
            .then(response => response.json())
            .then((data) => {
                let tempFlowsheetData = {...flowsheetData}
                tempFlowsheetData.name = value
                tempFlowsheetData.outputData = data.outputData
                tempFlowsheetData.inputData = data.inputData
                let tempData = {}
                Object.assign(tempData, tempFlowsheetData.inputData)
                setDisplayData({...tempData})
                updateFlowsheetData(tempFlowsheetData, "UPDATE_CONFIG")
                setConfigName(value);
            }).catch((err) => {
            console.error("unable to get load config: ", err)
        });

    };

    const handleDelete = () => {
        console.log('deleting id=', params.id, 'name=', configName)
        deleteConfig(params.id, configName)
            .then(response => response.json())
            .then((data) => {
                console.log('returned data (configs) ', data)
                setConfigName("");
                setPreviousConfigs(data)
                setOpenDeleteConfig(false)
            }).catch((err) => {
            console.error("unable to get load config: ", err)
            setOpenDeleteConfig(false)
        });
    }

    const handleUpdateDisplayValue = (id, value) => {
        let tempFlowsheetData = {...flowsheetData}
        const inputs = getInputs(tempFlowsheetData)
        console.debug('updating ' + id + ' with value ' + value + '. previous value was ' + inputs[id].value)
        inputs[id].value = value
        setInputsChanged(true)
    }

    const handleUpdateFixed = (id, value, type) => {
        let tempFlowsheetData = {...flowsheetData}
        const inputs = getInputs(tempFlowsheetData);
        inputs[id].fixed = value;
        inputs[id].is_sweep = (type === "sweep");
        updateFlowsheetData(tempFlowsheetData, null)
        setInputsChanged(true)
        runButtonRef.current?.checkDisableRun()
        // checkDisableRun()
    }

    const handleUpdateBounds = (id, value, bound) => {
        let tempFlowsheetData = {...flowsheetData}
        const inputs = getInputs(tempFlowsheetData)
        setInputsChanged(true)
        inputs[id][bound] = value
    }

    const handleUpdateSamples = (id, value) => {
        let tempFlowsheetData = {...flowsheetData}
        const inputs = getInputs(tempFlowsheetData)
        inputs[id].num_samples = value
        setInputsChanged(true)
        console.debug('updating samples ' + id + ' with value ' + value + ' ' + inputs[id].num_samples)
    }
    /**
     * Organize variables into sections by their 'category' attribute.
     *
     * @returns [Object(left) {<category-name>: [list, of, variable, objects]}, Object(right) {<category-name>: [list, of, variable, objects]}]
     */
    const organizeVariables = (bvars) => {
        let var_sections = {}
        for (const [key, v] of Object.entries(bvars)) {
            let catg = v.input_category
            let is_input = v.is_input
            let is_output = v.is_output
            // console.log("key",key)

            if (catg === null) {
                catg = ""
            }
            if (!Object.hasOwn(var_sections, catg)) {
                var_sections[catg] = {
                    display_name: catg,
                    variables: {},
                    input_variables: {},
                    output_variables: {}
                }
            }
            var_sections[catg]["variables"][key] = v
            if (var_sections[catg]['num_variables']) var_sections[catg]['num_variables'] = var_sections[catg]['num_variables'] + 1
            else var_sections[catg]['num_variables'] = 1
            if (is_input) var_sections[catg]["input_variables"][key] = v;
            if (is_output) var_sections[catg]["output_variables"][key] = v;


            //round values for input 
            try {
                let roundedValue
                if (v.rounding != null) {
                    if (v.rounding > 0) {
                        roundedValue = parseFloat((Number(v.value)).toFixed(v.rounding))
                    } else if (v.rounding === 0) {
                        roundedValue = Math.round(Number(v.value))
                    } else // if rounding is negative
                    {
                        let factor = 10 ** (-v.rounding)
                        roundedValue = Math.round((Number(v.value) / factor)) * factor
                    }
                } else // if rounding is not provided, just use given value
                {
                    roundedValue = v.value
                }
                var_sections[catg]["variables"][key].value = roundedValue
                if (is_input) var_sections[catg]["input_variables"][key].value = roundedValue;
                if (is_output) var_sections[catg]["output_variables"][key].value = roundedValue;
            } catch (e) {
                console.error('error rounding input for: ', v)
                console.error(e)
            }

        }

        /** 
         * sort the keys of var_sections into two groups that have as close as possible to even amount of total variables
         * we want the two columns to be roughly the same length if possible
        **/
        let var_sections_left = {}
        let var_sections_right = {}
        let total_variables_left = 0
        let total_variables_right = 0
        let next_section = "left"
        try {
            for (let category of Object.keys(var_sections)) {
                let section = var_sections[category]
                let input_data = section.input_variables

                // calculate variable amount - fixed variables take up about 45% as much space as free
                // if variable is fixed, count it as 1
                // if variable is free, count it as 2
                let variable_amount = 0 
                for (let input_variable_key of Object.keys(input_data)) {
                    let input_variable = input_data[input_variable_key]
                    if (input_variable.fixed) {
                        variable_amount += 1
                    }
                    else {
                        variable_amount += 2
                    }
                }
                
                if (next_section === "left") {
                    total_variables_left+=variable_amount
                    var_sections_left[category] = section
                    if (total_variables_left > total_variables_right) next_section = "right"
                }
                else // if (next_section === "right") 
                {
                    total_variables_right+=variable_amount
                    var_sections_right[category] = section
                    if (total_variables_right > total_variables_left) next_section = "left"
                }
            }
        } catch(e) {
            console.log("error sorting: ")
            console.log(e)
        }
        
        return [var_sections_left, var_sections_right]
    }

    const renderInputAccordions = () => {
        try {
            if (Object.keys(displayData).length > 0) {
                let var_sections = organizeVariables(displayData.exports)
                let var_sections_left = var_sections[0]
                let var_sections_right = var_sections[1]

                return <Grid container sx={{mt: 2}}>
                    <Grid item xs={5.8}>
                        {Object.entries(var_sections_left).map(([key, value]) => {
                            let _key;
                            if (key === undefined || key === null) {
                                _key = key + Math.floor(Math.random() * 100001);
                            } else {
                                _key = key + value.display_name + value.output_variables;
                            }
                            if (Object.keys(value.input_variables).length > 0) {
                                return (
                                    <InputAccordion
                                        key={_key}
                                        handleUpdateDisplayValue={handleUpdateDisplayValue}
                                        handleUpdateFixed={handleUpdateFixed}
                                        handleUpdateBounds={handleUpdateBounds}
                                        handleUpdateSamples={handleUpdateSamples}
                                        data={value}
                                        solveType={solveType}
                                    />)
                            }
                        })}
                    </Grid>
                    <Grid item xs={0.4}></Grid>

                    <Grid item xs={5.8}>
                        {Object.entries(var_sections_right).map(([key, value]) => {
                            let _key;
                            if (key === undefined || key === null) {
                                _key = key + Math.floor(Math.random() * 100001);
                            } else {
                                _key = key + value.display_name + value.output_variables;
                            }
                            if (Object.keys(value.input_variables).length > 0) {
                                return (
                                    <InputAccordion
                                        key={_key}
                                        handleUpdateDisplayValue={handleUpdateDisplayValue}
                                        handleUpdateFixed={handleUpdateFixed}
                                        handleUpdateBounds={handleUpdateBounds}
                                        handleUpdateSamples={handleUpdateSamples}
                                        data={value}
                                        solveType={solveType}
                                    />)
                            }
                        })}
                    </Grid>

                </Grid>
            }
        } catch (e) {
            // version of data is likely wrong
            // should we delete this data automatically? 
            // for now just output an error. the user will have the ability to delete this record
            console.error('unable to display this data, likely an incorrect version of data')
            console.error(e)
        }

    };


    return (
        <>
            <Box>
                <Grid container>
                    <Grid item xs={6}>
                        <Stack direction="row" spacing={2}>
                            {previousConfigs.length > 0 &&
                                <>
                                    <InputLabel style={{paddingTop: "8px"}}
                                                id="previous-configs-label">Saved
                                        Configurations:</InputLabel>
                                    <FormControl sx={{width: 200}}>
                                        <Select
                                            labelId="previous-configs-label"
                                            id="previous-configs-select"
                                            value={configName}
                                            onChange={handleConfigSelection}
                                            size="small"
                                        >
                                            {previousConfigs.map((name) => (
                                                <MenuItem
                                                    key={name}
                                                    value={name}
                                                >
                                                    {name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </>
                            }
                            {configName.length > 0 &&
                                <Button variant="outlined" color="error"
                                        startIcon={<DeleteForeverIcon/>}
                                        onClick={() => setOpenDeleteConfig(true)}>Delete</Button>
                            }
                        </Stack>
                    </Grid>

                    <Grid item xs={6}>
                        <Stack direction="row" spacing={2} justifyContent={'flex-end'}
                               alignItems={'flex-end'} sx={{marginBottom: 2}}>

                            <FormControl>
                                <InputLabel id="solve-sweep-label">Analysis
                                    Type</InputLabel>
                                <Select labelId="solve-sweep-label"
                                        id="solve-sweep-select" label="Analysis Type"
                                        size="small"
                                        sx={{textAlign: "left"}}
                                        value={solveType}
                                        onChange={props.handleSelectSolveType}
                                >
                                    <MenuItem id="solve-option" value="solve">single run</MenuItem>
                                    <MenuItem id="sweep-option" value="sweep">parameter sweep</MenuItem>
                                </Select>
                            </FormControl>
                            <div>
                                <Button id="reset-flowsheet-button" variant="outlined" startIcon={<RefreshIcon/>}
                                        onClick={reset} fullWidth>RESET</Button>
                            </div>
                            <RunButton
                                theme={theme}
                                updateFlowsheetData={updateFlowsheetData}
                                flowsheetData={flowsheetData}
                                disableRun={disableRun}
                                solveType={solveType}
                                ref={runButtonRef}
                            />
                        </Stack>
                    </Grid>

                </Grid>


            </Box>


            <Grid container spacing={2} alignItems="flex-start">
                {
                    renderInputAccordions()
                }
            </Grid>
            <Modal
                open={openDeleteConfig}
                onClose={() => setOpenDeleteConfig(false)}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Grid container sx={modalStyle} spacing={1}>
                    <Grid item xs={12}>
                        <Box justifyContent="center" alignItems="center" display="flex">
                            <p>Are you sure you want to delete {configName}?</p>
                        </Box>
                    </Grid>
                    <Grid item xs={12}>
                        <Box justifyContent="center" alignItems="center" display="flex">
                            <Button onClick={() => handleDelete()} variant="contained"
                                    color="error">Delete</Button>
                        </Box>
                    </Grid>
                </Grid>
            </Modal>
        </>


    );

}

const RunButton = forwardRef(({...props}, ref) => {
    // const [childDataApi, setChildDataApi] = useState(null);
    const theme = props.theme;
    const {updateFlowsheetData, flowsheetData, solveType} = props;
    const [disableRun, setDisableRun] = useState(false)
    useEffect(() => {
        checkDisableRun()
    }, [props])

    const checkDisableRun = () => {
        if (solveType === "solve") setDisableRun(false)
        else {
            let tempDisableRun = true
            const inputs = getInputs(flowsheetData)
            for (let each of Object.keys(inputs)) {
                let modelObject = inputs[each]
                if (modelObject.is_sweep) {
                    tempDisableRun = false
                    break
                }
            }
            setDisableRun(tempDisableRun)
        }
    }

    useImperativeHandle(ref, () => ({
        checkDisableRun
    }));

    return (
        <Tooltip
            title={disableRun ? "To run a sweep, at least one variable must be set to sweep" : ""}>
            <div>
                <Button 
                    id='run-flowsheet-button'
                    variant="contained"
                    onClick={() => updateFlowsheetData(flowsheetData.inputData, solveType)}
                    disabled={disableRun}>RUN
                </Button>
            </div>
        </Tooltip>
    );
});    