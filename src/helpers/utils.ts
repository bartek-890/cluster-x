import fs from 'fs';
import YAML from 'yaml';
import { ClusterCommunicator } from '../interfaces/interfaces';

export const readYamlConfiguration = (path: string) => {
    const file = fs.readFileSync(path, 'utf8');
    return YAML.parse(file);
};

export const sendToMainThread = (message: ClusterCommunicator) => {
    process.send(message);
};

