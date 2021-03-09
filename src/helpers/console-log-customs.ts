import chalk from 'chalk';

export const log = {
    standard: (text: string) => {
        console.log(`${chalk.green(text)}`);
    },
    process: (text: string) => {
        console.log(`${chalk.blueBright.bold('[PROCESS]')}: ${text}`);
    },
    memory: (text: string) => {
        console.log(`${chalk.magentaBright.bold('[MEMORY]')}: ${text}`);
    },
    warning: (text: string) => {
        console.log('---------------------------------');
        console.log(`${chalk.yellowBright.bold('[WARNING]')}: ${text}`);
    },
    info: (text: string) => {
        console.log('---------------------------------');
        console.log(`${chalk.cyanBright.bold('[INFO]')}: ${text}`);
    },
    error: (text: string) => {
        console.log('---------------------------------');
        console.log(`${chalk.redBright.bold('[ERROR]')}: ${text}`);
    },
};
