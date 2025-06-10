// const { series } = require('gulp');

// // The `clean` function is not exported so it can be considered a private task.
// // It can still be used within the `series()` composition.
// function clean(cb) {
//     // body omitted
//     cb();
// }

// // The `build` function is exported so it is public and can be run with the `gulp` command.
// // It can also be used within the `series()` composition.
// function build(cb) {
//     // body omitted
//     cb();
// }

// exports.build = build;
// exports.default = series(clean, build);
const gulp = require("gulp");
const zip = require("gulp-zip");
const git = require("gulp-git");
const util = require("gulp-util");
const template = require('gulp-template');
const rename = require('gulp-rename');
const fileinclude = require('gulp-file-include');
const version = require("pa-dss-version");

const fs = require("fs");
const path = require("path");
const argv = require("yargs").argv;
const exec = require("child_process").exec;

const filePathJS = __dirname + "\\MP5\\app\\Version.js";

function clear(text) {
    return text ? text.replace(/\r?\n|\r/g, "").replace(/[\s]+/, "") : "";
}
/**
* @param {number} t - a time or date chunk, representing either the month, day-of-month, hour, minute, or second
* @return {string}
*/
const add0 = t => t < 10 ? `0${t}` : String(t);

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
function asyncExec(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) console.warn(error);
            resolve(stdout ? stdout : stderr);
        });
    });
}

/**
 * errorHandler funcion para el manejo de error en la ejecucion de una tarea
 */
function errorHandler(error) {
    error.end();
}

function parseExtClass(cb) {
    fs.readFile(filePathJS, { encoding: "utf-8" }, function (err, data) {
        if (err) {
            throw err;
        }
        var jsonList = data.match(/\{[\s\w:'".,-]+\}/g) || [],
            jsonData = jsonList.length ? JSON.parse(jsonList[0]) : {};

        cb(jsonData);
    });
}
/**
 *  version number and tagging the repository with it.
 *
 * You can use the commands
 *
 * version.up('1.0.1.1.20', 'major'); // 2.0.0.0.0
 * version.up('5.0.1.1.0', 'minor'); // 5.1.0.0.0
 * version.up('7.0.1.1.0', 'secure'); // 7.0.2.1.0
 * version.up('4.0.1.1.0', 'crud'); // 4.0.1.2.0
 * version.up('3.0.1.1.14', 'interface'); // 3.0.1.1.15
 *
 * To bump the version numbers accordingly after you did a patch,
 * introduced a feature or made a backwards-incompatible release.
 */
function changeVersion(mode, message, cb) {
    parseExtClass(function (vFile) {
        let currentVersion = vFile.version;
        let vTag = version.up(currentVersion, mode);
        let tMode = message || mode;

        util.log("Change version", util.colors.blue(currentVersion), " to ", util.colors.green(vTag));

        git.exec({ args: 'log -n 1 --format="%h"', quiet: true, log: false }, function (err, stdout) {
            let checksum = clear(stdout);

            var contentDoc = `Ext.define("M5.Version", {\n\t "version": "${vTag}",\n\t "build": "${checksum}" \n});`;

            fs.writeFile(filePathJS, contentDoc, function (err) {
                if (err) throw err;
                git.exec({ args: `add  ${filePathJS}`, quiet: true, log: false }, (err, stdout, stderr) => {
                    if (err) throw err;
                    git.exec({ args: `commit -m "Change version to: v${vTag} Mode: ${tMode} [skip ci]" `, quiet: true, log: false }, (err, stdout, stderr) => {
                        if (err) throw err;
                        createTag(checksum, vTag, tMode, cb);
                    });
                }
                );
            });
        });
    });
}

/**
 * createTag genera una etiqueta asociada al un identificador de commit
 */
function createTag(checksum, version, mode, cb) {
    let tag = "v" + version;
    git.exec({ args: `tag -a  ${tag} ${checksum} -m "${mode}"`, quiet: true, log: false }, (err, stdout, stderr) => {
        git.exec({ args: "push --tag", quiet: true, log: false }, (err, stdout, stderr) => {
            if (err) {
                util.log(util.colors.red(err.message));
                throw err;
            }
            git.exec({ args: "push", quiet: true, log: false }, (err, stdout, stderr) => {
                if (err) {
                    util.log(util.colors.red(err.message));
                    throw err;
                }
                util.log(util.colors.green("Success..."));
                cb();
            });
        });
    });
}

/**
 * taskInformation muestra el menu de opciones de tareas para gulp
 */
function taskInformation(cb) {
    var info = [
        "",
        "MONITOR PLUS - TASK",
        "Tareas:",
        "Versiones",
        "  gulp major",
        "  gulp minor",
        "  gulp secure",
        "  gulp crud",
        "Versiones de interface:",
        "  gulp interface",
        "  gulp patch",
        "Modo de version de interface",
        "  gulp production",
        "  gulp development",
        "Empaquetado: *La generacion de un paquete zip incluye un cambio de verion de interface",
        "  gulp zip",
        "Control de cambios",
        // "  gulp changelog",
        "  gulp tags",
        "    -s --search    texto a buscar en el nombre de la etiqueta",
        "    -n --no        cantidad de registros a devolver en la consulta por defecto 10",
        ""
    ];

    console.log(info.join("\n"));
    cb();
}
/**
 * changeLog genera un bloque de cambios respecto a una version con prefijo
 * si esta no existiera genera generara un bloque de ultimos cambios hasta el header.
 * @param {Object} args  `{}` argumentos enviados en la invocacion de la tarea.
 */
function changeLog(args) {
    git.exec({ args: "tag --sort=-taggerdate", quiet: true, log: false }, (err, stdout, stderr) => {
        if (err) throw err;
        let postfix = args.p || args.postfix;
        if (stdout && postfix) {
            let tagList = stdout.split("\n");

            if (tagList.length) {
                let firstTag = null,
                    lastTag = null;
                for (let index = 0; index < tagList.length; index++) {
                    let element = tagList[index];
                    if (element.includes(postfix)) {
                        if (!lastTag) {
                            lastTag = element;
                        } else {
                            firstTag = element;
                            break;
                        }
                        firstTag = element;
                    }
                }
                if (firstTag && lastTag) {
                    changeLogCommand = `git log --no-merges --pretty=format:"* %h, %ae,  mensaje: %s" ${firstTag}..${lastTag}`;
                }
            }
        }
    });
}

const senchaCommand = 'sencha';
const buildOptions = 'app build -c -pr';

function generateZip(cb) {
    parseExtClass(function (vFile) {
        let currentDate = "";
        if (argv.d || argv.date) {
            let d = new Date();
            const h = add0(d.getHours());
            const min = add0(d.getMinutes());

            currentDate = " " + (d.getMonth() + 1) + "-" + d.getDate() + "-" + d.getFullYear() + "-" + h + min;
        }

        let fileName = `M5 v${vFile.version}${currentDate}.zip`;
        let filePath = __dirname + "\\MP5";
        const command = `${senchaCommand} ${buildOptions}`;

        const copysymlinks = 'xcopy /y /b /i ..\\theme.js production\\ && xcopy /y /b /i ..\\loadinglogo.svg production\\  && xcopy /y /i Web.config production\\'
        util.log("Call", util.colors.blue("Sencha Cmd"));
        util.log(util.colors.yellow("Please wait a moment while the process is over..."));
        exec(command, { cwd: filePath }, function (error, stdout, stderr) {
            if (error) {
                util.log(error.message);
                return error;
            }
            /**
             * @todo validar si el  build de sencha fue satisfactorio
             */
            util.log("Sencha App Build", util.colors.green("Success"), "...");

            util.log("Building:", util.colors.blue(fileName));

            exec(copysymlinks, { cwd: filePath }, function (error, stdout, stderr) {
                if (error) {
                    util.log(error.message);
                    return error;
                }

                util.log("Zip", "...");
                gulp.src('./MP5/production/**/*', { dot: true })
                    .pipe(zip(fileName))
                    .pipe(gulp.dest('./MP5/releases'));

                util.log(util.colors.green("Building success!"));
                cb();
            })
        });
    });
}

function historyTags(cb) {
    let n = Number.isInteger(argv.n) ? argv.n : 10;
    let s = argv.s || argv.search;
    let search = s ? `-l "*${s}*"` : "";
    const currentargs = `tag --sort=-taggerdate ${search} --format="%(tag), %(taggername), %(taggerdate), %(subject)" | head -n ${n}`
    git.exec({ args: currentargs, quiet: true, log: false }, (error, stdout, stderr) => {
        if (error) {
            util.log(util.colors.red(error.message));
            return error;
        }

        let firstList = stdout.split("\n") || [];

        if (firstList[0]) {
            for (let index = 0; index < firstList.length; index++) {
                let tagInfo = firstList[index];
                let infoList = tagInfo.split(",");
                let vTag = infoList[0];
                let vMode = infoList[3] || "";
                let isRelease = ["production", "development"].includes(vMode.trim());
                if (vTag) {
                    console.log(
                        [
                            isRelease ? util.colors.green(vTag) : util.colors.magenta(vTag),
                            util.colors.cyan(vMode),
                            util.colors.yellow(infoList[1]),
                            util.colors.blue(infoList[2])
                        ].join("\t")
                    );
                }
            }
        } else {
            util.log(util.colors.yellow("No tags to show..."));
        }

        cb();
    }
    );
}

const templateDir = 'template';
const viewDir = path.join('MP5', 'app', 'view');

const getPathOutput = function (output, _type) {
    if (_type === 'report') {
        return path.join(viewDir, 'report', ...output.split('.'));
    }

    return path.join(viewDir, ...output.split('.'));
};

const generator = function (_type) {
    const className = argv.name || 'GeneratedClass'; // Nombre de la clase proporcionado como argumento o valor predeterminado
    const output = argv.output || ''; // Nombre de la clase proporcionado como argumento o valor predeterminado

    // Generar archivo View.js
    const viewPromise = new Promise((resolve, reject) => {
        gulp.src(path.join(templateDir, _type, 'Example.js'))
            .pipe(fileinclude({
                prefix: '@@',
                basepath: '@file'
            }))
            .pipe(template({
                lowerCaseClassName: className.toLowerCase(),
                className: className,
                output: output
            }))
            .pipe(rename(`${className}.js`)) // Nombre del archivo de salida
            .pipe(gulp.dest(getPathOutput(output, _type))) // Ruta de salida
            .on('end', resolve)
            .on('error', reject);
    });

    // Generar archivo Controller.js
    const controllerPromise = new Promise((resolve, reject) => {
        gulp.src(path.join(templateDir, _type, 'ExampleController.js'))
            .pipe(fileinclude({
                prefix: '@@',
                basepath: '@file'
            }))
            .pipe(template({
                lowerCaseClassName: className.toLowerCase(),
                className: className,
                output: output
            }))
            .pipe(rename(`${className}Controller.js`)) // Nombre del archivo de salida
            .pipe(gulp.dest(getPathOutput(output, _type))) // Ruta de salida
            .on('end', resolve)
            .on('error', reject);
    });

    // Generar archivo ExampleModel.js
    const modelPromise = new Promise((resolve, reject) => {
        gulp.src(path.join(templateDir, _type, 'ExampleModel.js'))
            .pipe(fileinclude({
                prefix: '@@',
                basepath: '@file'
            }))
            .pipe(template({
                lowerCaseClassName: className.toLowerCase(),
                className: className,
                output: output
            }))
            .pipe(rename(`${className}Model.js`)) // Nombre del archivo de salida
            .pipe(gulp.dest(getPathOutput(output, _type))) // Ruta de salida
            .on('end', resolve)
            .on('error', reject);
    });

    return { viewPromise, controllerPromise, modelPromise };
};

gulp.task('generate-report', () => {
    const { viewPromise, controllerPromise, modelPromise } = generator('report');
    return Promise.all([viewPromise, controllerPromise, modelPromise]);
});

gulp.task('generate-crud', () => {
    const { viewPromise, controllerPromise, modelPromise } = generator('crud');
    return Promise.all([viewPromise, controllerPromise, modelPromise]);
});

/**
 * @todo definir la forma de generacion de etiquetas de version para ramas
 * @todo definir la manera de realizar el merge entre ramas con versiones
 *
 */
gulp.task("major", cb => {
    changeVersion("major", "", cb);
});

gulp.task("minor", cb => {
    changeVersion("minor", "", cb);
});

gulp.task("patch", cb => {
    changeVersion("interface", "", cb);
});

gulp.task("secure", cb => {
    changeVersion("secure", "", cb);
});

gulp.task("crud", cb => {
    changeVersion("crud", "", cb);
});

gulp.task("production", cb => {
    changeVersion("interface", "production", cb);
});

gulp.task("development", cb => {
    changeVersion("interface", "development", cb);
});

gulp.task("tags", historyTags);
/**
 * @todo definir una forma mas amigable de mostrar el resumen de commits asociados a una version
 */
gulp.task("changelog", args => {
    return changeLog(argv);
});

gulp.task("default", taskInformation);
gulp.task("zip", generateZip);