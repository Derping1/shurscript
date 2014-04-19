function FilterThreads() {
		
	this.id = arguments.callee.name; //ModuleID
	this.name = "Filtrado de hilos";
	this.author = "TheBronx + xusoO";
	this.version = "0.2";
	this.description = "Añade varias opciones a la lista de hilos de un subforo: Marcar hilos como favoritos, resaltarlos, u ocultar los temas que no te interesen. Ya sea de forma manual o automática mediante palabras clave.";
	this.enabledByDefault = true;
	
	var helper = new ScriptHelper(this.id);
	
	var favorites;
	
	var threads = [];
	
	var hideReadThreads = false;
	var readThreads = [];
	var hiddenThreads = [];
	var hiddenThreadsCount = 0;
	var hiddenThreadsBlock;
	var hideReadThreadsButton;
	var regexHiddenKeywords, regexHiddenUsers, regexHighlightKeywords;
	
	var highlightedOnTop, favoritesOnTop;
				
	this.shouldLoad = function() {
		 return (page == "/forumdisplay.php" || page == "/showthread.php" || page == "/search.php");
	}
	
	this.load = function() {
		
		loadStyles();
		
		favorites = GM_getValue("FC_FAVORITE_THREADS_" + userid); //Antiguos
		if (favorites) { //Migrar a la nueva estructura de datos
			helper.setValue("FAVORITES", favorites);
			GM_deleteValue("FC_FAVORITE_THREADS_" + userid);
		}
		
		favorites = JSON.parse(helper.getValue("FAVORITES", '[]'));
		
		favoritesOnTop = helper.getValue("FAVORITES_TOP", true);
		highlightedOnTop = helper.getValue("HIGHLIGHTED_TOP", true);
						
		if (page == "/forumdisplay.php" || page == "/search.php") {
			onForumDisplay();
		} else if (page == "/showthread.php") {
			onShowThread();
		}
	}
	
	function loadStyles() {
		var favsColor = helper.getValue("FAVORITES_COLOR", "#D5E6EE");
		if (favsColor !== "") {
			if (helper.getValue("FAVORITES_JUST_BORDER", false)) {
				GM_addStyle(".favorite>td:nth-child(3) {border-left: 4px solid " + favsColor + " !important}");
			} else {
				GM_addStyle(".favorite>td:nth-child(3) {background-color:" + favsColor + " !important;}");
			}
		}
		GM_addStyle(".fav img {display:none;} .fav {cursor: pointer; background-repeat:no-repeat; background-position: center; background-image:url('http://salvatorelab.es/images/star.png');min-width:20px;}");
		GM_addStyle(".shurmenu_trigger img, .shurmenu_opened img {display:none;} .shurmenu_trigger, .shurmenu_opened {cursor: pointer; background-repeat:no-repeat; background-position: center; background-image:url('http://i.imgur.com/CCQcR98.gif');min-width:20px;}");
		GM_addStyle(".not_fav img {display:none;} .not_fav {cursor: pointer; background-repeat:no-repeat; background-position: center; background-image:url('http://salvatorelab.es/images/nostar.png');min-width:20px;}");
		GM_addStyle(".shur_estrella {width:30px;vertical-align:middle;} .shur_estrella a {cursor: pointer; width:20px; height:20px; display:block; background-repeat:no-repeat; background-position: center; background-image:url('http://salvatorelab.es/images/nostar.png'); margin:0 auto;} .shur_estrella a.fav {background-image:url('http://salvatorelab.es/images/star.png');}");
		
		var highlightColor = helper.getValue("HIGHLIGHT_COLOR", "#FAF7DD");
		if (highlightColor !== "") {
			if (helper.getValue("HIGHLIGHT_JUST_BORDER", false)) {
				GM_addStyle(".highlighted>td:nth-child(3) {border-left: 4px solid " + highlightColor + "}");
			} else {
				GM_addStyle(".highlighted>td:nth-child(3) {background-color:" + highlightColor + ";}");
			}
		}
		
		if (helper.getValue("HIGHLIGHT_BOLD", true)) {
			GM_addStyle(".highlightKeyword {text-decoration: underline; color: black;}");
		}
		GM_addStyle(".hiddenKeyword {text-decoration: line-through; color: black;}");
	}
	
	
	/* Funcionalidad de ocultar hilos ya leídos */
	function createHideReadThreadsButton() {
	    hideReadThreads = helper.getValue("HIDDEN_READ_THREADS", false);
	    var forumToolsButton = $("#stickies_collapse").length ? $("#stickies_collapse") : $("#forumtools");
	    var hideReadThreadsLink = $('<a rel="nofollow">' + (hideReadThreads ? "Mostrar todos los hilos" : "Mostrar solo los hilos no leídos") + '</a>');
	    hideReadThreadsButton = $('<td class="vbmenu_control" nowrap="nowrap" style="cursor: pointer;"></td>');
	    hideReadThreadsButton.append(hideReadThreadsLink);
	    hideReadThreadsButton.click(function(){
	    	hideReadThreads = !hideReadThreads;
	    	if (hideReadThreads) {
			    $.each(readThreads, function(index, hilo){
			    	hilo.hideRead = true;
				    hilo.row.css("display", "none");
			    });
			    hideReadThreadsLink.html("Mostrar todos los hilos");
		    } else {
			    $.each(readThreads, function(index, hilo){
				    hilo.hideRead = false;
				    hilo.row.css("display", "table-row");
			    });
			    hideReadThreadsLink.html("Mostrar solo los hilos no leídos");
		    }
		    helper.setValue("HIDDEN_READ_THREADS", hideReadThreads);
	    });
	    forumToolsButton.before(hideReadThreadsButton);
	}
	
	/* Construye la expresion regular a partir de una lista de palabras */
	function getRegex(userInput, isRegex, wholeWords) {
		var regex;
		if (isRegex) {
			regex = new RegExp(userInput, "i");
		} else {
			userInput = userInput.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); //Escapar caracteres reservador de las regex
			userInput = userInput.replace(/[\ ]*[\,]+[\ ]*$/, ""); //Quitar comas sobrantes
			if (typeof wholeWords == "undefined" || wholeWords) {
				regex = "(\\b|\\ )"; //word-break
			} else {
				regex = "";
			}
			
			regex += "(" + userInput
					.replace(/[aáà]/ig, "[aáà]")
					.replace(/[eéè]/ig, "[eéè]")
					.replace(/[iíï]/ig, "[iíï]") //Accents insensitive
					.replace(/[oóò]/ig, "[oóò]")
					.replace(/[uúü]/ig, "[uúü]")
					.replace(/[\ ]*[\,]+[\ ]*/g, "|") + ")"; //Reemplazar las comas por |
			
			if (typeof wholeWords == "undefined" || wholeWords) {
				regex += "(\\b|\\ )"; //word-break
			}
			
			regex = new RegExp(regex, "i");
		}
		
		return regex;
	}
	
	/* Crear todas las expresiones regulares segun el input del usuario */
	function initRegexs() {
		//Crear regex de hilos ocultos
		var hiddenKeywords = helper.getValue("HIDDEN_KEYWORDS");
		if (hiddenKeywords && hiddenKeywords != "") {
			try {
				var hiddenKeywordsIsRegex = helper.getValue("HIDDEN_KEYWORDS_REGEX", false);
				regexHiddenKeywords = getRegex(hiddenKeywords, hiddenKeywordsIsRegex);
			} catch (e) {
				regexHiddenKeywords = null;
				bootbox.alert("Ha ocurrido un error. Revisa la expresión regular que has introducido para ocultar hilos.");
			}
		}
		
		//Crear regex de hilos ocultos por usuario
		var hiddenUsers = helper.getValue("HIDDEN_USERS");
		if (hiddenUsers && hiddenUsers != "") {
			try {
				regexHiddenUsers = getRegex(hiddenUsers, false);
			} catch (e) {
				regexHiddenUsers = null;
				bootbox.alert("Ha ocurrido un error. Revisa la expresión regular que has introducido para ocultar hilos por usuario.");
			}
		}
		
		
		//Crear regex para resaltar hilos 
		var highlightKeywords = helper.getValue("HIGHLIGHT_KEYWORDS");
		if (highlightKeywords && highlightKeywords != "") {
			try {
				var highlightKeywordsIsRegex = helper.getValue("HIGHLIGHT_KEYWORDS_REGEX", false);
				regexHighlightKeywords = getRegex(highlightKeywords, highlightKeywordsIsRegex);
			} catch (e) {
				regexHighlightKeywords = null;
				bootbox.alert("Ha ocurrido un error. Revisa la expresión regular que has introducido para resaltar hilos.");
			}
		}
	}
		
	function onForumDisplay() {
	
		createHideReadThreadsButton();
		
		createQuickFilter();

		//Evento para cerrar todos los popups abiertos al hacer clic en cualquier sitio (body)
		$('body').click(function (e) {
			
			if (e.target.className.indexOf("popover") == -1 && !jQuery.contains($(".popover")[0], e.target)) { //No estamos dentro del popup abierto
				$(".shurmenu_opened").not(e.target.id != "" ? "#" + e.target.id : "").removeClass("shurmenu_opened");
				
			    if (e.target.id.indexOf("statusicon") == -1) { //No estamos clicando en un icono del hilo (este ya tiene el manejador de abrir y cerrar el popup)
				    $(".popover").remove();
			    }
		    }
		});
		
		
		//Recuperar los hilos ocultos manualmente
		hiddenThreads = JSON.parse(helper.getValue("HIDDEN_THREADS", '[]'));
		
		initRegexs();

		//Recorremos todos los hilos de la lista	    
	    $('#threadslist tr').each( function(index) {
	    	try {
		    	var hilo = {};
		    	hilo.row = $(this);
		    	
		    	hilo.title_td = $(this).find('td[id^="td_threadtitle_"]');
		    	
		    	if (hilo.title_td.length != 0) {
			    	hilo.title_link = hilo.title_td.find('div > a[id^="thread_title_"]').first();
		            hilo.href = hilo.title_link.attr('href');
					hilo.id = parseInt(/.*showthread\.php\?.*t=([0-9]+).*/.exec(hilo.href)[1]);
		            hilo.title = hilo.title_link.html();
		            hilo.creator_span = hilo.title_td.find("div.smallfont > span:last-child");
		            hilo.creator = hilo.creator_span.text();
		            
		            hilo.icon_td = $(this).find('#td_threadstatusicon_' + hilo.id);
		            		            
		            processThread(hilo);
		            
		            hilo.icon_td.popover({content: getThreadMenu(hilo), container: 'body', placement: 'right', html: true, trigger: 'manual'});
			        
			        hilo.icon_td.click( function(e) {
				        $(".popover").remove();
				        $(this).popover('show');
				        $(".popover .popover-content").html(getThreadMenu(hilo));
				        $(this).addClass("shurmenu_opened");
			        });
			        
			        hilo.icon_td.hover(
		                function() {//mouse in
		                    $(this).addClass("shurmenu_trigger");
		                },
		                function() {//mouse out
		                    $(this).removeClass("shurmenu_trigger");
		                }
		            );
		            
		            threads.push(hilo);
			        
		        
		        }
	        } catch (e) {
		        alert(e);
	        }
	    });
	    

	}
	
	/* Aplicar funcionalidad al hilo en cuestion: marcarlo como favorito, ocultarlo, etc.*/
	function processThread(hilo) {
					
        if (page == "/search.php") { //En el buscador solo se activan los favoritos
	        if (favorites.indexOf( hilo.id ) >= 0) {
	            hilo.row.addClass("favorite");
	            hilo.isFavorite = true;
            }
        } else {

	        var matchResult;
	        
			if (hiddenThreads.indexOf(hilo.id) >= 0) { //Si está oculto manualmente, prevalece sobretodo lo demas
	            addToHiddenThreads(hilo);
	            hilo.isHidden = true;
		    } else if (favorites.indexOf( hilo.id ) >= 0) { //Después, si es favorito
	            hilo.isFavorite = true;
	            
	            if (favoritesOnTop) { //Lo movemos al principio de la lista
		        	if ($(".favorite").length > 0) {
			    		$(".favorite").last().after(hilo.row);
					} else if ($(".highlighted").length > 0) { //Tiene que estar por encima de los resaltados
						$(".highlighted").first().before(hilo.row)
					} else {
			    		$("#threadslist > tbody[id^='threadbits_forum'] > tr").first().before(hilo.row); //El primero de la lista
			    	}
	        	}
	            
	            hilo.row.addClass("favorite");
	        } else if (regexHiddenUsers && (matchResult = matchKeywords(hilo.creator, regexHiddenUsers, "hiddenKeyword"))) { //Si esta abierto por algun usuario que tengamos en la lista negra
	        	addToHiddenThreads(hilo);
	        	hilo.isHidden = true;
	        	hilo.isHiddenByUser = true;
	        	hilo.creator_span.html(matchResult);
	    	} else if (regexHiddenKeywords && (matchResult = matchKeywords(hilo.title, regexHiddenKeywords, "hiddenKeyword"))) { //Si concuerda con alguna palabra clave para ocultarlo
	        	addToHiddenThreads(hilo);
	        	hilo.isHidden = true;
	        	hilo.isHiddenByKeywords = true;
	        	hilo.title = matchResult;
	        	hilo.title_link.html(matchResult);
	    	}
	    	
	                
	        if (regexHighlightKeywords && (matchResult = matchKeywords(hilo.title, regexHighlightKeywords, "highlightKeyword"))) { //Si hay que resaltarlo por conincidir con las palabras clave definidas por el usuario
	        	hilo.isHighlighted = true;
	        	hilo.title_link.html(matchResult);
	        	
	        	if (!hilo.isHidden && !hilo.isFavorite && highlightedOnTop) { //Lo movemos al principio de la lista
		        	if ($(".highlighted").length > 0) {
			    		$(".highlighted").last().after(hilo.row);
					} else if ($(".favorite").length > 0) { //Tiene que estar por debajo de los favoritos
						$(".favorite").last().after(hilo.row)
					} else {
			    		 $("#threadslist > tbody[id^='threadbits_forum'] > tr").first().before(hilo.row); //El primero de la lista
					}
	        	}
	        	
	        	hilo.row.addClass("highlighted");
	        	
	        	if (hilo.isHiddenByKeywords) { //Avisar al usuario de que se ha ocultado un hilo que coincide con sus preferencias de resaltado
		        	hiddenThreadsBlock.find(".tcat").css("background", "#FBBD97");
	        	}
	        	
	        }
	        
	        if (!hilo.isHidden && hilo.icon_td.find("img").attr("src").indexOf("new.gif") == -1) { //Hilo leído
	        	if (hideReadThreads) {
	        		hilo.row.css("display", "none");
	        	}
	        	readThreads.push(hilo);
        	}
	        
        }
        
	}
	
	/* Comprueba si un texto coincide con unas palabras clave concretas. Devuelve el texto con las palabras resaltadas en negrita */
	function matchKeywords(text, regexKeywords, className) {
		var match = false;
		
		var matches = regexKeywords && regexKeywords.exec(text);
		
		var highlighted = text;
		while (matches != null && matches[0] != "") {
		    highlighted = highlighted.replace(matches[0].trim(), "<span class='" + className + "'>" + matches[0].trim() + "</span>");
		    text = text.substring(matches.index + matches[0].length);
		    matches = regexKeywords.exec(text);
		    match = true;
		}

		return match && highlighted;
	}
	

	/* Construye el menu que aparece al pulsar sobre el icono del hilo */
	function getThreadMenu(hilo) {
		$menu = $("<div class='shurscript'/>");
		if (!hilo.isHidden || hilo.isHiddenByKeyword) { //No tiene sentido marcar un hilo oculto como favorito
			$menu.append(getThreadMenuToggle(hilo, 'Quitar favorito', 'Favorito', GM_getResourceURL('star-img'), hilo.isFavorite, function(e){
				toggleFavorite(hilo);
				hilo.icon_td.removeClass('shurmenu_opened');
				$(".popover").remove();
			}));
		}
		if (page != "/search.php") {
			$menu.append(getThreadMenuToggle(hilo, 'Mostrar de nuevo', 'Ocultar', GM_getResourceURL('trash-img'), hilo.isHidden && !hilo.isHiddenByKeyword, function(e){
				toggleHidden(hilo);
				hilo.icon_td.removeClass('shurmenu_opened');
				$(".popover").remove();
			}, 'btn-danger'));
		}
		return $menu;
	}
	
	
	function getThreadMenuToggle(hilo, title_on, title_off, icon, active, onclick, className) {
		var $button = $('<button type="button" data-toggle="button" style="margin: 0 5px; display: inline-block;" class="btn btn-sm ' + (className ? className : 'btn-default') + '"><span style="background: url(\'' + icon + '\') no-repeat scroll 0% 0% transparent; height: 16px; display: inline-block; vertical-align: middle; width: 20px; margin-top: -2px;"></span><span>' + (active ? title_on : title_off) + '</span></button>');
		$button.click(function(){
			var title;
			if ($(this).hasClass("active")) {
				title = title_off;
			} else {
				title = title_on;
			}
			$(this).find("span")[0].style.backgroundImage = icon;
			$(this).find("span")[1].innerHTML = title;
		});
		if (active) {
			$button.addClass("active");
		}
		$button.click(onclick);
		return $button;
	}
	
	/* Oculta o muestra un hilo */
	function toggleHidden(hilo) {
		if (!hilo.isHidden) {
            hilo.row.fadeOut({complete:function(){
				markAsHiddenThread(hilo);
            	hilo.row.show(); //Despues del fadeOut, lo mostramos y ya aparecera en la seccion de hilos ocultos
			}});

        } else {
            hilo.row.fadeOut({complete:function(){
				unmarkAsHiddenThread(hilo);
            	hilo.row.show(); //Despues del fadeOut, lo mostramos y ya aparecera en la seccion de hilos ocultos
			}});
            
        }
        
	}
	
	/* Oculta un hilo */
	function markAsHiddenThread(hilo) {
		hilo.isHidden = true;
		
		hiddenThreads.push(hilo.id);
		
		if (hilo.isFavorite || favorites.indexOf( hilo.id ) >= 0) { //Si era favorito
            unmarkAsFavorite(hilo); //Ya no lo es
        }	
        
        addToHiddenThreads(hilo);
        
        saveHiddenThreads();
	}
	
	/* Lo añade al menu de hilos ocultos desde donde podra ser mostrado de nuevo */
	function addToHiddenThreads(hilo) {
	
		var hiddenThreadsList = $("#hiddenthreadslist");
		
		if (hiddenThreadsList.length == 0) {
			var threadsList = $("#threadslist");
			
			hiddenThreadsList = $('<table id="hiddenthreadslist" class="tborder" cellspacing="1" cellpadding="5" border="0" width="100%" align="center">');
			
			hiddenThreadsList.append(threadsList.find('tbody').first().clone()); //Añadimos el nombre de las columnas
			
			var threadsListHeader = threadsList.prev();
			var hiddenThreadsHeader = $('<table id="hiddenthreadsheader" class="tborder" cellspacing="1" cellpadding="5" border="0" width="100%" align="center" style="cursor: pointer;"><tr><td class="tcat" width="100%"><span style="background: url(\'' + GM_getResourceURL('trash-black-img') + '\') no-repeat scroll 0% 0% transparent; height: 16px; display: inline-block; vertical-align: middle; width: 20px; margin-top: -2px;"></span><span id="numhiddenthreads">0</span> Hilo(s) oculto(s)</td></tr></table>');
			hiddenThreadsHeader.click(function(){
				hiddenThreadsList.parent().slideToggle();
			});
			
			threadsListHeader.before(hiddenThreadsList);
			hiddenThreadsList.before(hiddenThreadsHeader);
			
			hiddenThreadsList.wrap('<div id="hiddenthreadslistwrapper" style="overflow: hidden;"></div>'); //No podemos hacer la animacion de slide con una tabla, la hacemos sobre un div sin overflow
			hiddenThreadsList.parent().hide(); //La ocultamos por defecto
			$("#hiddenthreadsheader, #hiddenthreadslistwrapper").wrapAll('<div id="hiddenthreads" style="margin-bottom: 15px;"></div>');
			hiddenThreadsBlock = $("#hiddenthreads");
			
		}
		
		hiddenThreadsList.append(hilo.row);
		
		hiddenThreadsCount++;
		
		if (hiddenThreadsCount == 1) {
			hiddenThreadsBlock.show();
		}
		
		hiddenThreadsBlock.find("#numhiddenthreads").html(hiddenThreadsCount);	

	}
	
	/* Vuelve a mostrar un hilo que estaba oculto */
	function unmarkAsHiddenThread(hilo) {
		removeElementFromArray(hilo.id, hiddenThreads);
		
		hilo.icon_td.removeClass('shurmenu_opened');
		
		hilo.isHidden = false;
        
        removeFromHiddenThreads(hilo);
        
		saveHiddenThreads();
	}
	
	/* Lo quitamos del menu de hilos ocultos y lo metemos de nuevo en el general */
	function removeFromHiddenThreads(hilo) {
		
		/*
if (hilo.originalPosition) {
			$("#threadslist > tbody[id^='threadbits_forum'] > tr:nth-child(" + (hilo.originalPosition - 1) + ")").after(hilo.row);
		} else {
*/
			$("#threadslist > tbody[id^='threadbits_forum']").append(hilo.row);
/* 		} */
		hiddenThreadsCount--;
		hiddenThreadsBlock.find("#numhiddenthreads").html(hiddenThreadsCount);
		if (hiddenThreadsCount == 0) {
			hiddenThreadsBlock.hide();
			hiddenThreadsBlock.find("#hiddenthreadslistwrapper").hide();
		}
		
	}
	
	/* Marcar o desmarcar un hilo favorito */
	function toggleFavorite(hilo) {
		if (!hilo.isFavorite) {
            //lo agregamos a favoritos
            markAsFavorite(hilo)
        } else {
            //lo borramos de favoritos
            unmarkAsFavorite(hilo);
        }
	}
	
	function markAsFavorite(hilo) {
		favorites.push(hilo.id);
		
        $(hilo.row).addClass("favorite");
        hilo.isFavorite = true;
        saveFavorites();
	}
	
	function unmarkAsFavorite(hilo) {
		removeElementFromArray(hilo.id, favorites);
        $(hilo.row).removeClass("favorite");
        hilo.isFavorite = false;
        saveFavorites();
	}
	
	function createQuickFilter() {
		var quickFilter = $("<input name='quickFilter' placeholder='Filtro rápido...'/>");
		var quickFilterWrapper = $("<td class='tcat' style='padding:0px 4px;'/>");
		quickFilterWrapper.append(quickFilter);
		
		if (page == "/search.php") {
			$("#threadslist .tcat span").last().append(quickFilterWrapper);
        } else {
			hideReadThreadsButton.before(quickFilterWrapper);
        }
		
		var delayer;
		var filterFunction = function() {
			if (quickFilter.val() == "" || quickFilter.val().length <= 2) {
				threads.forEach(function(hilo) {
					if (!hilo.hideRead) { //Si estaba oculto antes de filtrar por estar leído (es el único tipo de ocultación que tiene un display:none;)
		        		hilo.row.css("display", "table-row");
		        	}
			        hilo.title_link.html(hilo.title);
				});
			} else {
				var regex = getRegex(quickFilter.val(), false, false);
				threads.forEach(function(hilo) {
					if (hilo.isHidden) {
						return;
					}
								
					var matchResult;
					if (!hilo.hideRead && (matchResult = matchKeywords(hilo.title, regex, "highlightKeyword"))) { //Si hay que resaltarlo por conincidir con las palabras clave definidas por el usuario
			        	hilo.title_link.html(matchResult);
			        	hilo.row.css("display", "table-row");
			        } else {
				        hilo.title_link.html(hilo.title);
			        	hilo.row.css("display", "none");
			        }
				});
			}
		};
		
		quickFilter.keydown(function(event) {
			if (event.which == 27) { //Escape
				setTimeout(function(){quickFilter.val("");quickFilter.trigger("input");}, 1); //No sé porqué pero si no se hace en un timer no se vacía :roto2:
			} else if (event.which == 13) { //Enter
				event.preventDefault(); //Evita que se haga el submit de un formulario que tiene por encima
			}
			
		});
		
		quickFilter.on("input", function() {
			clearTimeout(delayer);
			delayer = setTimeout(filterFunction, 200);
		});
		
		

	}
	
	function onShowThread() {
		//estamos viendo un hilo, ¿que hilo es?
		//la pregunta tiene miga, ya que en la URL no tiene por qué venir el topic_id
		var href = $("#threadtools_menu form>table tr:last a").attr("href");
		if (href.indexOf("subscription")!=-1) {
			var t_id = parseInt(href.replace("subscription.php?do=addsubscription&t=",""),10);
		} else {
			var t_id = parseInt(href.replace("poll.php?do=newpoll&t=",""),10);
		}
		//vale, ahora que sabemos que hilo es, ¿es favorito?
		var is_favorite = false;
		if ( favorites.indexOf( t_id ) >= 0 ) {
	        //es un hilo favorito
			is_favorite = true;
		} else {
			//no es un hilo favorito
			is_favorite = false;
		}
		//agregamos la estrella junto a los botones de responder
		var estrella = '<td class="shur_estrella"><a href="#" class="'+ (is_favorite ? 'fav':'') +'"></a></td>';
		//boton de arriba
		$("#poststop").next().find("td.smallfont").first().before(estrella);
		//boton de abajo
		$("#posts").next().find("table td.smallfont").first().before(estrella);
		
		//eventos
		$(".shur_estrella a").each( function() {
			$(this).click( function() {
				if (is_favorite) {
					is_favorite = false;
					//borramos de favoritos
					removeElementFromArray(t_id, favorites);
					//quitamos el class
					$(".shur_estrella a").each( function() { $(this).removeClass('fav') });
				} else {
					is_favorite = true;
					//agregamos a favoritos
					favorites.push(t_id);
					//agregamos el class
					$(".shur_estrella a").each( function() { $(this).addClass('fav') });
				}
				saveFavorites();
				return false;
			});
		});
	}
	
	function saveFavorites() {
		helper.setValue("FAVORITES", JSON.stringify(favorites));
	}
	
	function saveHiddenThreads() {
		helper.setValue("HIDDEN_THREADS", JSON.stringify(hiddenThreads));
	}
	
	function removeElementFromArray(element, array) {
		var index = array.indexOf(element);
		if (index > -1) {
			array.splice(index, 1);
		}
	}

	this.getPreferences = function() {
		var preferences = new Array();
		
		var hiddenThreadsSection = [];
		hiddenThreadsSection.push(new BooleanPreference("HIDDEN_READ_THREADS", false, "Mostrar solo hilos no leídos. <span style='color:gray;'>De cualquier modo aparecerá un botón para ocultarlos o mostrarlos. Esta opción solo cambia el comportamiento por defecto.</span>"));
		hiddenThreadsSection.push(new TextPreference("HIDDEN_USERS", "", "Por usuario <b>(separados por comas)</b>"));
		hiddenThreadsSection.push(new TextPreference("HIDDEN_KEYWORDS", "", "Por palabras clave <b>(separadas por comas)</b>"));
		hiddenThreadsSection.push(new BooleanPreference("HIDDEN_KEYWORDS_REGEX", false, "<b>Avanzado:</b> Usar expresión regular en las palabras clave"));

		preferences.push(new SectionPreference("Ocultar hilos", "Puedes ocultar hilos de forma automática, ya sea mediante una lista negra de usuarios o por palabras clave en el título de los temas.", hiddenThreadsSection));
		
		var highlightedThreadsSection = [];
		highlightedThreadsSection.push(new TextPreference("HIGHLIGHT_KEYWORDS", "", "Por palabras clave <b>(separadas por comas)</b>"));
		highlightedThreadsSection.push(new BooleanPreference("HIGHLIGHT_KEYWORDS_REGEX", false, "<b>Avanzado:</b> Usar expresión regular en las palabras clave"));
		highlightedThreadsSection.push(new ColorPreference("HIGHLIGHT_COLOR", "#FAF7DD", "Color", "El color de fondo para los hilos resaltados. Por defecto #FAF7DD"));
		highlightedThreadsSection.push(new BooleanPreference("HIGHLIGHT_JUST_BORDER", false, "Aplicar color solo al borde izquierdo"));
		highlightedThreadsSection.push(new BooleanPreference("HIGHLIGHT_BOLD", true, "Resaltar palabras clave en los títulos de los hilos"));
		highlightedThreadsSection.push(new BooleanPreference("HIGHLIGHTED_TOP", true, "Colocar siempre en primer lugar los hilos resaltados"));

		preferences.push(new SectionPreference("Resaltar hilos", "Los hilos que contengan cualquiera de estas palabras serán resaltados con los colores selccionados de entre el resto de hilos.", highlightedThreadsSection));
		
		var favoriteThreadsSection = [];
		/*
favoriteThreadsSection.push(new BooleanPreference("FAVORITES_SUSCRIBED", true, "Suscribirse automáticamente a todos los hilos marcados como favoritos"));
		favoriteThreadsSection.push(new BooleanPreference("FAVORITES_SUSCRIBED", true, "Resaltar los hilos suscritos como si fueran favoritos"));
*/
		favoriteThreadsSection.push(new ColorPreference("FAVORITES_COLOR", "#D5E6EE", "Color de fondo", "El color de fondo para los hilos favoritos. Por defecto #D5E6EE"));
		favoriteThreadsSection.push(new BooleanPreference("FAVORITES_JUST_BORDER", false, "Aplicar color solo al borde izquierdo"));
		favoriteThreadsSection.push(new BooleanPreference("FAVORITES_TOP", true, "Colocar siempre en primer lugar los hilos marcados como favoritos"));

		
		preferences.push(new SectionPreference("Hilos favoritos", "Mostrará un icono al lado de cada hilo para marcarlo como favorito. Los hilos favoritos destacarán entre los demás cuando el usuario entre a algún subforo.", favoriteThreadsSection));
		
		
		return preferences;
	};
	
	
}

