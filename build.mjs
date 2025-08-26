#!/usr/bin/env node
/**
 * Simple Build Script For PHP Site
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import esbuild from 'esbuild';
import postcss from 'postcss';
import autoprefixer from "autoprefixer";
import tailwindcss from '@tailwindcss/postcss';
import cssnano from 'cssnano';
import chokidar from 'chokidar';
import * as sass from 'sass';
import cpy from 'cpy';
import liveServer from 'live-server';
import {sync} from 'rimraf';

const SRC = "./src";
const DIST = "./dist";
const TMP = "./tmp";

const args = process.argv.slice(2);
const cmd = args[0] || "build";

async function run() {
    switch (cmd) {
        case "clean":
            sync(DIST);
            sync(TMP);
            console.log("Cleaned ./dist and ./tmp!");
            break;
        case "build":
            await buildAll({production: true});
            break;
        case "dev":
            await buildAll({production:false, watch:true, serve:true});
            break;
        default:
            console.error(`Unknown Command: ${cmd}`);
            process.exit(1);
    }
}

async function buildAll({production,watch,serve}) {
    fs.mkdirSync(DIST, {recursive:true});
    fs.mkdirSync(path.join(DIST, "assets"), {recursive:true});
    fs.mkdirSync(TMP, {recursive:true});

    await buildCSS({production, watch});
    await buildJS({production, watch});
    await copyStatic({watch});

    if (serve) {
        liveServer.start({
            root: DIST,
            open: true,
            port: 8080,
            logLevel:1
        });
        console.log("🚀 Serving on http://localhost:8080");
    }
}

async function buildCSS({production,watch}) {
    const srcFile = path.join(SRC, "styles/main.scss");
    const tmpFile = path.join(TMP, "main.css");
    const outFile = path.join(DIST, "assets/main.css");

    const compile = async () => {
        console.log("Compiling main.scss......");
        const result = sass.compile(srcFile, {style:"expanded"});
        console.log("Compiled!")
        fs.writeFileSync(tmpFile, result.css);
        console.log("Wrote to temp file....");
        const plugins = [tailwindcss, autoprefixer];
        if (production) plugins.push(cssnano({preset:"default"}));
        const processed = await postcss(plugins).process(
            fs.readFileSync(tmpFile, "utf8"),
            {from:tmpFile}
        );
        console.log("Processing Done.");
        fs.writeFileSync(outFile, processed.css);
        console.log(`CSS Built! ${outFile}`);
    };

    await compile();

    if (watch) {
        chokidar.watch(path.join(SRC, "styles/**/*.scss")).on('change', compile);
        chokidar.watch(path.join(SRC, "**/*.{html,php,js}")).on('change', compile);
        console.log("Watching CSS!");
    }
}

async function buildJS({production, watch}) {
    const ctx = await esbuild.context({
        entryPoints: [path.join(SRC, 'js/app.js')],
        bundle:true,
        sourcemap:!production,
        minify:production,
        outdir:path.join(DIST,"assets"),
        logLevel:"silent"
    });
    if (watch) {
        await ctx.watch();
        console.log("Watching JS!");
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log("JS Built!");
    }
}

async function copyStatic({watch}) {
    const copyAll = async () => {
        await cpy([`${SRC}/**/*.html`, `${SRC}/**/*.php`], DIST);
        await cpy([`${SRC}/assets/**/**`], path.join(DIST, "assets"));
        console.log("Static Files Copied!");
    };

    await copyAll();

    if (watch) {
        chokidar.watch([`${SRC}/**/*.{html|php}`,  `${SRC}/assets/**/*`]).on("all", copyAll);
        console.log("Watching static files.");
    }
}

run();