var fs = require('fs');
var papa = require('papaparse');
const vega = require('vega');

function buildSplomDataset(rrd){

    splomDataset = rrd.map(dataset => {
        const data2 = new Array();
        const dims = [
            'mean', 'median', 'std', 'skew', 'kurt',
        ];
    
        dataset.windows.forEach((w) => {
            w.phases[0].sources.forEach(s => {
            let title = w.size + ' - ' + s.source;
            let values = new Map();
            let labels = [];
            dims.forEach((d) => {
                values[d] = new Array();
            });
            s.nodes.forEach((n) => {
                Object.entries(n).forEach(e => {
                if (e[0] === 'uid') {
                    labels.push(e[1]);
                } else {
                    values[e[0]].push(e[1]);
                }
                });
            });
            data2.push({title, dims, labels, values});
            });
        
        });
    
        return data2;
    
    });
    
    nodeData = splomDataset[0][0].labels.map((s, i) => ({
        label: s,
        phase: 'A',
        kurt: splomDataset[0][0].values['kurt'][i],
        mean: splomDataset[0][0].values['mean'][i],
        median: splomDataset[0][0].values['median'][i],
        skew: splomDataset[0][0].values['skew'][i],
        std: splomDataset[0][0].values['std'][i],
    }));
    
    return nodeData;
}

function buildTrellisDataset(rrd){

    trellisDataset = [];
    rrd.forEach((dataset) => {
      dataset.windows.map(w => {
        w.phases.map(p => {
          p.sources.map(s => {
            s.nodes.map(n => {
              this.trellisDataset.push({
                date: dataset.date,
                size: w.size,
                phase: p.phase,
                source: s.source,
                uid: n.uid,
                mean: n.mean,
                median: n.median,
                std: n.std,
                skew: n.skew,
                kurt: n.kurt
              });
            });
          });
        });
      });
    });

    return trellisDataset;
}

async function buildTimeSeriesDataset(rrd) {

    var windows = [];
    var phases = [];
    var sources = [];
    var uids = [];

    for (var d of rrd) {
        for (var w of d.windows) {
            windows.push(w.size);
            for (var p of w.phases) {
                phases.push(p.phase);
                for (var s of p.sources) {
                    sources.push(s.source);
                    for (var n of s.nodes) {
                        uids.push(n.uid);
                    }
                }
            }
        } 
    }

    /*rrd.forEach(async d => {
      d.windows.forEach(async w => {
        windows.push(w.size);
        w.phases.forEach(async p => {
          phases.push(p.phase);
          p.sources.forEach(async s => {
            sources.push(s.source);
            s.nodes.forEach(async n => uids.push(n.uid));
          });
        });
      });
    });*/

    windows = [... new Set(windows)];
    phases = [... new Set(phases)];
    sources = [... new Set(sources)];
    uids = [... new Set(uids)];

    temporalDataset = [];
    var reqs = [];

    for await(var u of uids) {
        for await(var p of phases) {
            for await(var s of sources) {
                for await (var w of windows) {
                    var result = await loadData(u, p, s, w);
                    reqs.push(result);
                    //reqs.push(await loadData(u, p, s, w));
                }
            }
        }
    }

    /*uids.forEach(async u => {
      phases.forEach(async p => {
        sources.forEach(async s => {
          windows.forEach(async w => {
            var result = await loadData(u, p, s, w);
            reqs.push(result);
            //console.log(result);
          });
        });
      });
    });*/

    return reqs;
}

async function loadData(uid, phase, source, windowSize) {

    var fileDir = "public/data/mv_avg_sep/"+ [uid.replace('%23', '#'), phase, source, windowSize].join('_') + '.csv'
    
    rd = fs.readFileSync(fileDir, 'utf-8');
    var res = await parseCSV(rd);

    var result = res.data.map((e) => ({
        time: new Date(e.TimeStamp).getTime(), value: +e[res.meta.fields[1]], group: windowSize
        })).map((res) => ({
            uid: uid,
            phase: phase,
            window: windowSize,
            source: source,
            data: res
        })
    );
    
    return result;
}

/*async function getFileName(uid, phase, source, windowSize){
    return [uid.replace('%23', '#'), phase, source, windowSize].join('_') + '.csv';
}*/

async function parseCSV(text){
    return papa.parse(text, { header: true, skipEmptyLines: true });
}

module.exports.mainView = async function(req, res) {

    var lc = req.params.lc;
    var da = req.params.da;
    var o1 = req.params.o1;
    var o2 = req.params.o2;

    var rd = fs.readFileSync('public/data/metadata.json', 'utf-8')
    var rrd = await JSON.parse(rd).data;
    timeseriesData = await buildTimeSeriesDataset(rrd);

    var spec_json = fs.readFileSync('public/data/vega.spec.json', 'utf-8');
    var spec_j = JSON.parse(spec_json);
    var spec = spec_j.vega_line_chart;

    var view = new vega.View(vega.parse(spec), {renderer: "none"})
    
    //example vega image
    var timePoints = [];
    var timePoints1 = [].concat.apply([], timeseriesData[0].map(e => e.data));
    var timePoints2 = [].concat.apply([], timeseriesData[1].map(e => e.data));

    var timePoints = timePoints1.concat(timePoints2)

    view.data('table', timePoints).toSVG()
    .then(function(svg) {
        res.send(svg);
    });
}