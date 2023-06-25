/*

© 2023 Samuel Bradshaw
https://github.com/samuelbradshaw/transcript-tracer-js

*/


// Global state variables
var ttIsInitialized = false;
var ttTranscripts;
var ttMediaPlayers;
var ttActivePlayer;
var ttLinkedDataByMediaUrl = {};

// Configuration variables (see README.md)
var ttBlockSelector = null;
var ttPhraseSelector = null;
var ttAlignmentFuzziness = 0;
var ttTimeOffset = 0;
var ttAutoScroll = null;
var ttClickable = false;


// Prepare transcripts and media players
function loadTranscriptTracer(options=null) {
  if (document.readyState == 'loading') {
    // Wait for document to load
    document.addEventListener('DOMContentLoaded', function() {
      loadTranscriptTracer(options);
    });
    return;
  }
  
  // Save user-provided options to configuration variables
  if (options) {
    if ('blockSelector' in options) ttBlockSelector = options.blockSelector;
    if ('phraseSelector' in options) ttPhraseSelector = options.phraseSelector;
    if ('alignmentFuzziness' in options) ttAlignmentFuzziness = options.alignmentFuzziness;
    if ('timeOffset' in options) ttTimeOffset = options.timeOffset;
    if ('autoScroll' in options) ttAutoScroll = options.autoScroll;
    if ('clickable' in options) ttClickable = options.clickable;
  }
  
  // Reset Transcript Tracer to prevent unexpected behavior if loadTranscriptTracer() is called more than once
  if (ttIsInitialized) {
    if (ttTranscripts) for (const transcript of ttTranscripts) {
      unlinkTranscript(transcript);
      transcript.dataset.ttTranscript = '';
    }
    ttTranscripts = null;
    ttMediaPlayers = null;
    ttActivePlayer = null;
    ttLinkedDataByMediaUrl = {};
    document.querySelectorAll('.tt-word, .tt-whitespace').forEach(element => {
      element.outerHTML = element.innerHTML;
    });
  }
  
  // Set a few global state variables
  ttIsInitialized = true;
  ttTranscripts = document.getElementsByClassName('tt-transcript');
  ttMediaPlayers = document.querySelectorAll('audio, video');

  // Prepare transcript for alignment by adding spans and classes
  for (let t = 0; t < ttTranscripts.length; t++) {
    var transcript = ttTranscripts[t];
    // Skip transcript if it's not linked to any media files
    if (!transcript.dataset.ttMediaUrls) continue;
  
    transcript.dataset.ttTranscript = t;
  
    // Loop through text nodes to add spans (tt-word, tt-whitespace)
    // Method of iterating text nodes thanks to https://stackoverflow.com/a/34700627/1349044
    var iter = document.createNodeIterator(transcript, NodeFilter.SHOW_TEXT);
    var textNode;
    while (textNode = iter.nextNode()) {
      const text = textNode.textContent;
      if (text.replace(/\s/g, '').length != 0) {
        var spannedText = '<span class="tt-word">' + text.replace(/(\s+)/g, '</span><span class="tt-whitespace">$1</span><span class="tt-word">') + '</span>';
        spannedText = spannedText.replaceAll('<span class="tt-word"></span>', '');
        
        // Replace text node with spanned text
        const template = document.createElement('template');
        template.innerHTML = spannedText;
        textNode.parentNode.insertBefore(template.content, textNode);
        textNode.parentNode.removeChild(textNode);
      }
    }
  }
  
  for (const mediaPlayer of ttMediaPlayers) {
    // Link related transcript(s)
    linkTranscripts(mediaPlayer);
    
    // Add event listener to media player
    mediaPlayer.addEventListener('play', function(e) {
      if (ttActivePlayer != e.currentTarget) {
        if (ttActivePlayer) {
          ttActivePlayer.pause();
          ttActivePlayer.removeEventListener('timeupdate', ttTimeUpdate);
        }
        ttActivePlayer = e.currentTarget;
      }
      ttActivePlayer.addEventListener('timeupdate', ttTimeUpdate);
      var currentTranscript = ttTranscripts[ttLinkedDataByMediaUrl[ttActivePlayer.dataset.ttLinkedMediaUrl].transcriptIndex];
      currentTranscript.dataset.ttCurrentMediaUrl = ttActivePlayer.dataset.ttLinkedMediaUrl;
    });
  }
}


// Link media player to relevant transcripts
function linkTranscripts(mediaPlayer) {
  var trackElement = mediaPlayer.querySelector('track[kind="metadata"]')

  var mediaPlayerSourceUrls = [];
  var mediaPlayerSrc = mediaPlayer.getAttribute('src');
  var mediaPlayerSourceElements = mediaPlayer.querySelectorAll('source');
  if (mediaPlayerSrc) mediaPlayerSourceUrls.push(mediaPlayerSrc);
  if (mediaPlayerSourceElements) for (const s of mediaPlayerSourceElements) mediaPlayerSourceUrls.push(s.src);
  
  // If there's nothing to link, return
  if (!trackElement || !trackElement.getAttribute('src') || mediaPlayerSourceUrls.length == 0) return;
  
  // Fetch WebVTT content and link related transcripts
  for (const transcript of ttTranscripts) {    
    for (const mediaUrl of mediaPlayerSourceUrls) {
      if (transcript.dataset.ttMediaUrls.includes(mediaUrl)) {
        mediaPlayer.dataset.ttLinkedMediaUrl = mediaUrl;
        unlinkTranscript(transcript);
        fetch(trackElement.src)
          .then(r => r.text())
          .then(vttContent => linkTranscript(mediaPlayer, vttContent, transcript));
        break;
      }
    }
  }

  function linkTranscript(mediaPlayer, vttContent, transcript) {
    var wordTimings = parseVttToWordTimings(vttContent);
    transcript.dataset.ttCurrentMediaUrl = mediaPlayer.dataset.ttLinkedMediaUrl;
    
    function normalizedWord(word) {
      // Convert to lowercase, normalize, and remove anything that's not a letter or number
      return word.toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
    }
    
    // Add metadata to block and phrase containers (if ttBlockSelector and ttPhraseSelector are defined)
    var blockContainers = ttBlockSelector ? transcript.querySelectorAll(ttBlockSelector) : [];
    for (let c = 0; c < blockContainers.length; c++) blockContainers[c].dataset.ttBlock = c;
    var phraseContainers = ttPhraseSelector ? transcript.querySelectorAll(ttPhraseSelector) : [];
    for (let c = 0; c < phraseContainers.length; c++) phraseContainers[c].dataset.ttPhrase = c;
    
    // Add metadata to each word span, and build timed events list
    var timedEvents = [];
    var wordTimingsIndex = 0;
    var wordSpans = transcript.getElementsByClassName('tt-word');
    for (let s = 0; s < wordSpans.length; s++) {
      var span = wordSpans[s];
    
      // Find the next word timing object that matches the current span's text            
      var initialWordTimingsIndex = wordTimingsIndex;
      var maxFuzzyWordTimingsIndex = Math.min(wordTimingsIndex + ttAlignmentFuzziness, wordTimings.length - 1);
      while (normalizedWord(span.innerText) != normalizedWord(wordTimings[wordTimingsIndex].text) && wordTimingsIndex <= maxFuzzyWordTimingsIndex) {
        wordTimingsIndex += 1;
      }
      if (normalizedWord(span.innerText) != normalizedWord(wordTimings[wordTimingsIndex].text)) {
        // Could not find matching word within the fuzziness range
        wordTimingsIndex = initialWordTimingsIndex;
        continue;
      }
      
      // Get the block, phrase, and word index
      blockIndex = ttBlockSelector ? (span.closest(ttBlockSelector)?.dataset?.ttBlock ?? null) : wordTimings[wordTimingsIndex].blockIndex;
      phraseIndex = ttPhraseSelector ? (span.closest(ttPhraseSelector)?.dataset?.ttPhrase ?? null) : wordTimings[wordTimingsIndex].phraseIndex;
      wordIndex = wordTimings[wordTimingsIndex].wordIndex;
      
      // Add block, phrase, and word index as metadata on the span
      span.dataset.ttBlock = blockIndex;
      span.dataset.ttPhrase = phraseIndex;
      span.dataset.ttWord = wordIndex;

      // Add timed event to timed events list
      if (timedEvents.length != 0 && wordTimings[wordTimingsIndex].startSeconds == timedEvents[timedEvents.length-1].seconds) {
        timedEvents[timedEvents.length-1].currentWordIndexes.push(wordIndex);
      } else {
        timedEvents.push({
          'seconds': wordTimings[wordTimingsIndex].startSeconds,
          'currentWordIndexes': [wordIndex],
          'phraseIndex': phraseIndex,
          'blockIndex': blockIndex,
        });
      }
    
      wordTimingsIndex += 1;
    }

    // For a given element, find the first parent element containing relevant children
    function findRelevantParent(startingElement, endingElement, childSelector, relevantChildSelector) {
      var currentElement = startingElement;
      while (currentElement != endingElement) {
        var currentElement = currentElement.parentElement;
        var children = currentElement.querySelectorAll(childSelector);
        var relevantChildren = document.querySelectorAll(relevantChildSelector);
        if (children.length == relevantChildren.length) {
          // Relevant parent found
          return currentElement;
        } else if (children.length > relevantChildren.length) {
          // Failed to find a relevant parent
          break;
        }
      }
      return null;
    }
    
    // Add metadata to block and phrase containers (if ttBlockSelector and ttPhraseSelector aren't defined)
    if (!ttBlockSelector) {
      var count = wordTimings[wordTimings.length-1].blockIndex + 1;
      for (let c = 0; c < count; c++) {
        var startingElement = document.querySelector(`[data-tt-block="${c}"]`);
        var blockContainer = findRelevantParent(startingElement, transcript, '[data-tt-word]', `[data-tt-word][data-tt-block="${c}"]`);
        if (blockContainer) blockContainer.dataset.ttBlock = c;
      }
    }
    if (!ttPhraseSelector) {
      var count = wordTimings[wordTimings.length-1].phraseIndex + 1;
      for (let c = 0; c < count; c++) {
        var startingElement = document.querySelector(`[data-tt-phrase="${c}"]`);
        var phraseContainer = findRelevantParent(startingElement, transcript, '[data-tt-word]', `[data-tt-word][data-tt-phrase="${c}"]`);
        if (phraseContainer) phraseContainer.dataset.ttPhrase = c;
      }
    }
    
    // Sort timed events list by time
    timedEvents = timedEvents.sort(function(a, b) { 
      return a.seconds - b.seconds;
    })
    
    // Add reference data to ttLinkedDataByMediaUrl
    var transcriptIndex = parseInt(transcript.dataset.ttTranscript);
    ttLinkedDataByMediaUrl[mediaPlayer.dataset.ttLinkedMediaUrl] = {
      'transcriptIndex': transcriptIndex,
      'wordTimings': wordTimings,
      'timedEvents': timedEvents,
      'mediaElement': mediaPlayer,
      'textTrackData': mediaPlayer.textTracks[0],
    }

    // Add click listeners to words
    if (ttClickable) {
      for (const word of document.querySelectorAll('.tt-word')) {
        word.addEventListener('click', handleWordClick);
      }
    }
  }
}


// Unlink transcript from previous VTT
function unlinkTranscript(transcript) {
  clearHighlightedWords(transcript);
  
  var ttLinkedElements = transcript.querySelectorAll('[data-tt-word]');
  for (const element of ttLinkedElements) {
    element.dataset.ttWord = '';
    element.dataset.ttPhrase = '';
    element.dataset.ttBlock = '';
  }
  
  var mediaUrl = transcript.dataset.ttCurrentMediaUrl;
  if (mediaUrl) {
    delete ttLinkedDataByMediaUrl[mediaUrl]
    transcript.dataset.ttCurrentMediaUrl = '';
  }
  
  for (const word of document.querySelectorAll('.tt-word')) {
    word.removeEventListener('click', handleWordClick);
  }
}


// Convert WebVTT into a wordTimings list
function parseVttToWordTimings(vttContent) {
  var wordTimings = [];
  
  // Split WebVTT at each double line break
  var vttSegments = vttContent.split(/\r?\n\r?\n/);
  if (vttSegments.length == 0 || !vttSegments[0].startsWith('WEBVTT')) {
    console.error('Error: Invalid VTT file. See https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API');
    return;
  }
  
  // Loop through each segment of the WebVTT
  // WebVTT documentation: https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API
  var cueWordCounter = 0;
  var cuePhraseCounter = 0;
  var cueBlockCounter = 0;
  for (let s = 0; s < vttSegments.length; s++) {
    var segment = vttSegments[s];
    
    // Skip segment if it's not a cue
    if (segment.startsWith('WEBVTT') || /^STYLE\s/.test(segment) || /^NOTE\s/.test(segment)) continue;
  
    // Convert VTT timestamps to seconds
    function convertVttTimestampToSeconds(vttTimestamp) {
      var parts = vttTimestamp.trim().split(':');
      var seconds = 0;
      if (parts.length == 3) { // 00:02:01.003
        seconds = (parseFloat(parts[0]) * 60 * 60) + (parseFloat(parts[1]) * 60) + parseFloat(parts[2])
      } else { // 02:01.003
        seconds = (parseFloat(parts[0]) * 60) + parseFloat(parts[1])
      }
      return seconds;
    }
    
    // Parse cue
    var cueIdentifier = cuePayload = '';
    var cueStartSeconds = cueEndSeconds = null;
    var segmentLines = segment.split(/\r?\n/);
    for (const line of segmentLines) {
      if (line.includes('-->')) {
        // Cue timings (single line)
        cueStartSeconds = wordStartSeconds = convertVttTimestampToSeconds(line.split('-->')[0].trim());
        cueEndSeconds = convertVttTimestampToSeconds(line.split('-->')[1].trim());
      } else if (cueStartSeconds == null) {
        // Cue identifier (optional)
        cueIdentifier += line;
      } else {
        // Cue payload (may be multiple lines)
        cuePayload += line;
        var cueWords = line.split(/\s/)
        for (let word of cueWords) {
          var matches = Array.from(word.matchAll(/(^<\d*:?\d+:\d+\.\d+>)?(.+$)/g));
          if (matches.length == 1 && matches[0][1] != null) {
            match = matches[0];
            wordStartSeconds = convertVttTimestampToSeconds(match[1].replace('<', '').replace('>', ''));
            word = match[2];
          }
          
          // Push word to wordTimings list
          if (word) {
            wordTimings.push({
              'text': word,
              'startSeconds': wordStartSeconds,
              'endSeconds': cueEndSeconds,
              'wordIndex': cueWordCounter,
              'phraseIndex': cuePhraseCounter,
              'blockIndex': cueBlockCounter,
            })
            cueWordCounter += 1;
          }
        }
        cuePhraseCounter += 1;
      }
    }
    cueBlockCounter += 1;
  }
  
  return wordTimings;
}


// Respond to timeupdate event (progress as the audio or video is playing)
var ttCurrentTranscript = null;
var ttPreviousEvent = null;
var ttCurrentEvent = null;
var ttNextEvent = null;
function ttTimeUpdate(e) {
  // If the current player isn't active or doesn't have data, return
  if (!ttActivePlayer || e.currentTarget != ttActivePlayer || !(ttActivePlayer.dataset.ttLinkedMediaUrl in ttLinkedDataByMediaUrl)) return;
  
  var adjustedCurrentTime = ttActivePlayer.currentTime + (ttTimeOffset * -1);
  var ttData = ttLinkedDataByMediaUrl[ttActivePlayer.dataset.ttLinkedMediaUrl];
  
  // Make sure the correct transcript is selected
  if (!ttCurrentTranscript || !ttCurrentTranscript.dataset.ttTranscript == ttData.transcriptIndex) {
    ttCurrentTranscript = document.querySelector(`[data-tt-transcript="${ttData.transcriptIndex}"]`);
  }
  
  // If before the first event, after the last event, or within the range of the current event, return
  if (ttCurrentEvent && (ttCurrentEvent.seconds < ttData.timedEvents[0].seconds || ttCurrentEvent.seconds > ttData.timedEvents[ttData.timedEvents.length-1].seconds)) return;
  if (ttCurrentEvent && ttNextEvent && ttCurrentEvent.seconds <= adjustedCurrentTime && ttNextEvent.seconds > adjustedCurrentTime) return;
  
  // Clear words that were highlighted from the previous event
  clearHighlightedWords(ttCurrentTranscript);
  
  // Add highlights for the current event
  for (let t = 0; t < ttData.timedEvents.length; t++) {
    if (ttData.timedEvents[t].seconds <= adjustedCurrentTime && (!ttData.timedEvents[t+1] || adjustedCurrentTime < ttData.timedEvents[t+1]?.seconds)) {
      
      ttPreviousEvent = ttData.timedEvents[t-1] || null;
      ttCurrentEvent = ttData.timedEvents[t];
      ttNextEvent = ttData.timedEvents[t+1] || null;
      
      // Mark blocks
      if (ttCurrentEvent.blockIndex != null) {
        var blockElements = ttCurrentTranscript.querySelectorAll(`[data-tt-block="${ttCurrentEvent.blockIndex}"]`);
        for (let b = 0; b < blockElements.length; b++) blockElements[b].classList.add((b==0 && !blockElements[b].classList.contains('tt-word')) ? 'tt-current-block-container' : 'tt-current-block');
      }
      
      // Mark phrases
      if (ttCurrentEvent.phraseIndex != null) {
        var phraseElements = ttCurrentTranscript.querySelectorAll(`[data-tt-phrase="${ttCurrentEvent.phraseIndex}"]`);
        for (let p = 0; p < phraseElements.length; p++) phraseElements[p].classList.add((p==0 && !phraseElements[p].classList.contains('tt-word')) ? 'tt-current-phrase-container' : 'tt-current-phrase');
      }
      
      // Mark words
      if (ttCurrentEvent.currentWordIndexes.length > 0) {
        for (const wordIndex of ttCurrentEvent.currentWordIndexes) {
          var wordElements = ttCurrentTranscript.querySelectorAll(`[data-tt-word="${wordIndex}"]`);
          for (const wordElement of wordElements) wordElement.classList.add('tt-current-word');
        }
        for (const wordElement of ttCurrentTranscript.getElementsByClassName('tt-word')) {
          if (wordElement.classList.contains('tt-current-word')) break;
          wordElement.classList.add('tt-previous-word');
        }
      }
      
      // Auto-scroll to the highlighted text
      if (ttAutoScroll) {
        var scrollOptions = { behavior: 'smooth', block: 'start', inline: 'nearest' }
        if (ttAutoScroll == 'block' && ttPreviousEvent?.blockIndex != ttCurrentEvent.blockIndex) {
          document.querySelector('.tt-current-block-container').scrollIntoView(scrollOptions);
        } else if (ttAutoScroll == 'phrase' && ttPreviousEvent?.phraseIndex != ttCurrentEvent.phraseIndex) {
          document.querySelector('.tt-current-phrase-container').scrollIntoView(scrollOptions);
        } else if (ttAutoScroll == 'word') {
          document.querySelector('.tt-current-word').scrollIntoView(scrollOptions);
        }
      }
      
      break;
    }
  }
}


// Clear highlighted words in transcript
function clearHighlightedWords(transcript) {
  var ttHighlightedElements = transcript.querySelectorAll('[class*="tt-current"], [class*="tt-previous"]');
  for (const element of ttHighlightedElements) {
    element.classList.remove('tt-current-block', 'tt-current-block-container', 'tt-current-phrase', 'tt-current-phrase-container', 'tt-current-word', 'tt-previous-word');
  }
}


// Handle when a word in the transcript with an event listener is clicked
function handleWordClick(e) {
  var wordElement = e.currentTarget;
  var wordIndex = wordElement.dataset.ttWord;
  var transcript = wordElement.closest('.tt-transcript');
  var mediaUrl = transcript.dataset.ttCurrentMediaUrl;
  var startSeconds = ttLinkedDataByMediaUrl[mediaUrl].wordTimings[wordIndex].startSeconds
  ttLinkedDataByMediaUrl[mediaUrl].mediaElement.currentTime = startSeconds;
}
