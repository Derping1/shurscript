/**
 * Módulo de sincronización de preferencias en la nube
 * Sobreescribe los métodos getValue, setValue y deleteValue del objeto core.GreaseMonkey
 * IMPORTANTE: debe cargarse antes que cualquier otro componente/módulo que no sea el propio core
 */
(function ($, SHURSCRIPT, undefined) {
	'use strict';

	var sync = SHURSCRIPT.core.createComponent('sync');

	//por si queremos usar los get/set/delete que trabajan en local y no en la nube
	var noCloud = {
		setValue: SHURSCRIPT.GreaseMonkey.setValue,
		getValue: SHURSCRIPT.GreaseMonkey.getValue,
		deleteValue: SHURSCRIPT.GreaseMonkey.deleteValue
	};

	var Cloud = {
		server: "",
		apiKey: "",
		preferences: {}, //las preferencias sacadas del server

		setValue: function (key, value, callback) {
			GM_xmlhttpRequest({
				method: 'PUT',
				url: this.server + 'preferences/' + key + '/?apikey=' + this.apiKey,
				data: $.param({'value': value}),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				onload: function (response) {
					if (callback) {
						callback(JSON.parse(response.responseText));
					}
				}
			});
		},

		getValue: function (key, callback, defaultValue) {
			GM_xmlhttpRequest({
				method: 'GET',
				url: this.server + 'preferences/' + key + '/?apikey=' + this.apiKey,
				data: '',
				onload: function (response) {
					if (callback) {
						callback(JSON.parse(response.responseText));
					}
				}
			});
		},

		getAll: function (callback) {
			SHURSCRIPT.config.apiKey = this.apiKey;

			if (!this.server)
			{
				sync.helper.log("Es necesario configurar la URL del backend");
				callback();
				return;
			}
			sync.helper.log("Cloud.getAll() using API key: " + this.apiKey);
			GM_xmlhttpRequest({
				method: 'GET',
				url: this.server + 'preferences/?apikey=' + this.apiKey,
				data: '',
				onload: function (response) {
					// TODO [igtroop] Parece ser que un error 403 no entra dentro de onerror :roto2: de momento duplicamos el código hasta probarlo en todas las extensiones
					switch (response.status) {
						case 200: //API Key válida
							Cloud.preferences = JSON.parse(response.responseText);
							callback();
							break;
						case 403: //API Key no encontrada
							bootbox.confirm("<h3>¡Un momento!</h3>La Shurkey que estás utilizando no es válida. ¿Quieres que te generemos una nueva?", function (res) {
								if (res) {
									Cloud.generateApiKey(function () {
										Cloud.getAll(callback);
									});
								}
							});
							break;
						case 410: //API Key invalidada
							sync.helper.deleteLocalValue("API_KEY");
							getApiKey( Cloud.getAll(callback) );
							break;
						case 500: //Error general
						default:
							sync.helper.showMessageBar({message: "<strong>Oops...</strong> No se ha podido contactar con el cloud de <strong>shurscript</strong>. Consulta qué puede estar causando este problema en <a href='https://github.com/igtroop/shurscript/wiki/FAQ#no-se-ha-podido-contactar-con-el-cloud-de-shurscript'>las F.A.Q.</a> y, si el problema persiste, deja constancia en el <a href='" + SHURSCRIPT.config.fcThread + "'>hilo oficial</a>. <strong>{err: general}</strong>", type: "danger"});
							// TODO [igtroop]: aunque falle al cargar las preferencias seguimos para poder acceder a la configuración de la URL del backend
							callback();
							break;
					}
				},
				onerror: function (response) {
					switch (response.status) {
						case 403: //API Key no encontrada
							bootbox.confirm("<h3>¡Un momento!</h3>La Shurkey que estás utilizando no es válida. ¿Quieres que te generemos una nueva?", function (res) {
								if (res) {
									Cloud.generateApiKey(function () {
										Cloud.getAll(callback);
									});
								}
							});
							break;
						case 410: //API Key invalidada
							sync.helper.deleteLocalValue("API_KEY");
							getApiKey( Cloud.getAll(callback) );
							break;
						case 500: //Error general
						default:
							sync.helper.showMessageBar({message: "<strong>Oops...</strong> No se ha podido contactar con el cloud de <strong>shurscript</strong>. Consulta qué puede estar causando este problema en <a href='https://github.com/igtroop/shurscript/wiki/FAQ#no-se-ha-podido-contactar-con-el-cloud-de-shurscript'>las F.A.Q.</a> y, si el problema persiste, deja constancia en el <a href='" + SHURSCRIPT.config.fcThread + "'>hilo oficial</a>. <strong>{err: general}</strong>", type: "danger"});
							// TODO [igtroop]: aunque falle al cargar las preferencias seguimos para poder acceder a la configuración de la URL del backend
							callback();
							break;
					}
					sync.helper.throw("Error al recuperar las preferencias", response);
				}
			});
		},

		deleteValue: function (key, callback) {
			//TODO
			//set empty
			this.setValue(key, '', callback);
		},

		generateApiKey: function (callback, oldKey) {
			sync.helper.deleteLocalValue("API_KEY");
			sync.helper.log("Cloud.generateApiKey()");
			// TODO [igtroop]: aunque falle al cargar las preferencias seguimos para poder acceder a la configuración de la URL del backend
			if (!this.server) {
				callback();
				return;
			}
			GM_xmlhttpRequest({
				method: 'POST',
				url: this.server + 'preferences/' + (oldKey !== undefined ? "?apikey=" + oldKey : ""),
				data: '',
				onload: function (response) {
					var data = JSON.parse(response.responseText);
					sync.helper.log("Generated API Key:" + JSON.stringify(data));
					Cloud.apiKey = data.apikey;
					saveApiKey(Cloud.apiKey); //guardamos la API key generada en las suscripciones
					callback();
				}
			});
		}
	};

	//Punto de entrada al componente.
	sync.loadAndCallback = function (callback) {
		//sobreescribimos las funciones de manejo de preferencias
		
		sync.helper.log("loadAndCallback");
		if (SHURSCRIPT.config.store_mode == "local")
		{
			SHURSCRIPT.GreaseMonkey.setValue = function (key, value, callback) {
				noCloud.setValue(key, value);
				if (callback) {
					callback();
				}
			};

			SHURSCRIPT.GreaseMonkey.getValue = function (key, defaultValue) {
				return noCloud.getValue(key, defaultValue);
			};

			SHURSCRIPT.GreaseMonkey.deleteValue = function (key, callback) {
				noCloud.deleteValue(key);
				if (callback) {
					callback();
				}
			};

			callback(); //notificamos al core, el siguiente componente ya puede cargar
		}
		else {
			// [callback] es opcional, se ejecuta una vez los datos se guardan en el servidor asíncronamente
			SHURSCRIPT.GreaseMonkey.setValue = function (key, value, callback) {
				Cloud.preferences[key] = value; //Copia local
				Cloud.setValue(key, value, callback);
			};

			SHURSCRIPT.GreaseMonkey.getValue = function (key, defaultValue) {
				//utilizamos la copia local de esa clave (si leyésemos del server los getValue serían asíncronos)
				return (Cloud.preferences[key] != undefined) ? Cloud.preferences[key] : defaultValue;
			};

			SHURSCRIPT.GreaseMonkey.deleteValue = function (key, callback) {
				Cloud.deleteValue(key, callback);
			};

			//obtenemos la URL del backend
			var backendURL = getBackendURL();
			if (backendURL) {
				Cloud.server = backendURL;
			}

			//ahora necesitamos la API key. ¿existe ya una API Key guardada en las suscripciones?
		 	getApiKey( function () {
				if (Cloud.apiKey) {
					//tenemos apikey, usémosla
					Cloud.getAll(callback);//una vez recuperadas las preferencias notificamos al core para que cargue el siguiente componente
				} else {
					//hay que pedirle una al server y guardarla en las suscripciones
					//una vez tengamos la apiKey, la usamos
					Cloud.generateApiKey(function () {
						Cloud.getAll(callback); //notificamos al core, el siguiente componente ya puede cargar
					});
				}
			});
		 }
	};

	/**
	 * Genera una nueva API key e invalida la antigua
	 */
	sync.generateNewApiKey = function (callback) {
		getApiKey( function () {
			Cloud.generateApiKey(callback, Cloud.apiKey); //Le pasamos la antigua para que la invalide
		});
	};

	/**
	 * Devuelve la API key guardada en las suscripciones del foro.
	 */
	function getApiKey(callback) {
		var apiKey = sync.helper.getLocalValue("API_KEY");

		//Si no la tenemos guardada en local la buscamos en las suscripciones y la guardamos en local para evitar hacer cada vez una llamada para recuperar las suscripciones
		if (!apiKey) {
			GM_xmlhttpRequest({
				method: 'GET',
				url: '//www.forocoches.com/foro/subscription.php?do=editfolders', //La buscamos en la carpeta falsa que se crea en las suscripciones
				data: '',
				onload: function (response) {
					var documentResponse = $.parseHTML(response.responseText);
					var folder = $(documentResponse).find("input[name='folderlist[50]']");
					if (folder.length > 0) {
						//la API key existe
						apiKey = folder.val().replace("shurkey-", "");
						Cloud.apiKey = apiKey;
						sync.helper.setLocalValue("API_KEY", apiKey);
					}
					callback();
				}
			});
		}
		else {
			Cloud.apiKey = apiKey;
			callback();
		}
	}

	/**
	 * Guarda la API key en las suscripciones
	 * Comprueba que el guardado sea exitoso. En caso contrario insiste una y otra vez...
	 */
	function saveApiKey(apiKey) {
		var securitytoken = $("input[name='securitytoken']").val(); //Numero de seguridad que genera el vbulletin para autenticar las peticiones

		// En la frontpage no aparece el securitytoken necesario para editar las carpetas, así que hacemos una petición para parsear el HTML y obtenerlo
		if (!securitytoken) {
				GM_xmlhttpRequest({
				method: 'GET',
				url: '//www.forocoches.com/foro/subscription.php?do=editfolders',
				data: '',
				onload: function (response) {
					var documentResponse = $.parseHTML(response.responseText);
					var securitytoken = $(documentResponse).find("input[name='securitytoken']").val();
					saveApiKeyWithToken(apiKey, securitytoken);
				}
			});
		}
		else {
			saveApiKeyWithToken(apiKey, securitytoken);
		}
	}

	function saveApiKeyWithToken(apiKey, securitytoken) {
		var folderName = "shurkey-" + apiKey;
		GM_xmlhttpRequest({
			method: 'POST',
			url: '//www.forocoches.com/foro/subscription.php?do=doeditfolders',
			data: 's=&securitytoken=' + securitytoken + '&do=doeditfolders&folderlist[50]=' + folderName + '&do=doeditfolders',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			onload: function (response) {
				// TODO [igtroop] De momento mejor arriesgarse a que no guarde nada a hacer peticiones continuas :)
				/*
				if (getApiKey() == false) { //comprobamos que se ha guardado. si no se ha guardado
					saveApiKeyWithToken(apiKey, securitytoken); //insistimos, hasta que se guarde o algo pete xD
				}
				*/
			}
		});
	}

	/**
	 * Devuelve la URL guardada en local del backend.
	 */
	function getBackendURL() {
		var actual_backendURL = SHURSCRIPT.core.helper.getLocalValue("BACKEND_URL");

		return actual_backendURL;
	}

	/**
	 * Guarda la URL del backend en local.
	 */
	sync.saveBackendURL = function (new_backendURL) {
		SHURSCRIPT.core.helper.setLocalValue("BACKEND_URL", new_backendURL);
		SHURSCRIPT.config.server = new_backendURL;
	}

})(jQuery, SHURSCRIPT);
