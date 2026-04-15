export type ApiEndpoints = {
	User: string;
	Node: string;
	ApiKey: string;
	PreAuthKey: string;
	Policy: string;
	Health: string;
	Debug: string;
};

export const API_URL_USER = '/api/v1/user';
export const API_URL_NODE = '/api/v1/node';
export const API_URL_POLICY = '/api/v1/policy';
export const API_URL_APIKEY = '/api/v1/apikey';
export const API_URL_PREAUTHKEY = '/api/v1/preauthkey';
export const API_URL_HEALTH = '/api/v1/health';
export const API_URL_DEBUG = '/api/v1/debug';