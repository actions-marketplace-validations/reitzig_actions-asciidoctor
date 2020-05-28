const core = require('@actions/core');
const exec = require('@actions/exec');
const fs  = require('fs');
const io = require('@actions/io');
const path = require('path')

function gemfile(version) {
    return `
        source 'https://rubygems.org'

        gem 'asciidoctor', '${version}'
    `
}

function wrapperScript(binary, options) {
    return `
        #!/usr/bin/env bash

        ${binary} \\
            ${options} \\
            "\$@"
    `
}

async function run() {
    try {
        const asciidoctorVersion = core.getInput('version');
        const asciidoctorOptions = core.getInput('options');

        core.startGroup('Install asciidoctor')
        workdir = 'actions_asciidoctor'
        await io.mkdirP(workdir)

        gemfilePath = path.join(workdir, 'Gemfile')
        await fs.promises.writeFile(
            gemfilePath,
            gemfile(asciidoctorVersion)
        )
        core.info(`Created ${gemfilePath}`)

        const options = {
            cwd: workdir
        }
        await exec.exec('bundle', ['config', 'set', 'path', `vendor/bundle`], options)
        await exec.exec('bundle', ['install'], options)
        core.endGroup()

        core.startGroup('Wrap asciidoctor with options')
        let bundlePath = ''
        options.listeners = {
            stdout: (data) => {
                bundlePath += data.toString()
            }
        }
        await exec.exec('bundle', ['info', '--path', 'asciidoctor'], options)
        asciidoctorBinary = path.join(bundlePath.trim(), 'bin', 'asciidoctor')
        core.debug(`True binary at ${asciidoctorBinary}`)

        asciidoctorWrapper = path.join(workdir, 'asciidoctor')
        await fs.promises.writeFile(
            asciidoctorWrapper,
            wrapperScript(asciidoctorBinary, asciidoctorOptions)
        )
        await fs.promises.chmod(asciidoctorWrapper, 0o755)
        core.info(`Created ${asciidoctorWrapper}`)
        core.addPath(path.resolve(workdir))

        await exec.exec('asciidoctor', ['--version'])
    } catch (error) {
        core.setFailed(error.message);
    }
}

run()
