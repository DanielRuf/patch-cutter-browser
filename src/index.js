const JSZip = require('jszip');
const FileSaver = require('file-saver');
const LineReader = require('./util/LineReader');
require('./main.css');

function init() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/patch-cutter-browser/sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }
}

function handleFileSelect(evt) {
    var files = evt.target.files; // FileList object

    // files is a FileList of File objects. List some properties.
    var output = [];
    if (files.length) {
        output = `
        <li>
            <strong>${escape(files[0].name)}</strong>
            (${(files[0].type || 'n/a')})
            - ${files[0].size} bytes,
            last modified: ${new Date(files[0].lastModified).toLocaleDateString()}
        </li>`;

        document.getElementById('list').innerHTML = `<ul>${output}</ul>`;

        // Create a new instance of the LineReader
        var lr = new LineReader();
        var zip = new JSZip();

        let patchNum = 0;
        let patchPath = '';
        let patchContent = [];

        const patchFileName = files[0].name;

        // Bind to the line event
        lr.on('line', function (line, next) {
            if (line.startsWith('diff --git')) {
                if (patchNum) {
                    console.log(`Creating patch ${patchNum} (${patchPath})`);
                    zip.file(patchPath, `${patchContent.join('\n')}\n`);
                    patchContent = [];
                }
                patchNum++;
                const pathMatcher = /diff --git a\/(.+) b\/(.+)/;
                const pathMatches = line.match(pathMatcher);
                patchPath = `${pathMatches[1]}.patch`;
                patchContent.push(line);
            } else {
                if (patchNum) {
                    patchContent.push(line);
                }
            }

            next(); // Call next to resume...
        });

        lr.on('end', function () {
            if (patchNum) {
                console.log(`Creating patch ${patchNum} (${patchPath})`);
                zip.file(patchPath, `${patchContent.join('\n')}\n`);
                patchContent = [];
            }
            zip.generateAsync({ type: "blob" }).then(function (content) {
                FileSaver.saveAs(content, patchFileName + '.zip');
            });

        });

        // Begin reading the file
        lr.read(files[0]);
    }
}

init();
document.getElementById('files').addEventListener('change', handleFileSelect, false);