# Transcript Tracer

Transcript Tracer is a JavaScript utility that allows you to sync audio or video with corresponding text on an HTML page (the “transcript”), using WebVTT timestamps. The currently-playing word, phrase, or block can be styled with CSS.

The fastest way to get started is to download the file `transcript-tracer.js` to your project folder, then copy and paste from the examples below. If you run into problems, go through the checklist in the [Troubleshooting](#troubleshooting) section. If you’re still stuck, feel free to open a GitHub issue.


## Minimal code example

```
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>One Small Step</title>
    <style>
      .tt-current-word { font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>One Small Step</h1>
    
    <audio preload="metadata" src="https://www.nasa.gov/62284main_onesmall2.wav" controls>
      <track kind="metadata" src="http://samuelbradshaw.github.io/transcript-tracer-js/examples/one-small-step.vtt">
    </audio>
    
    <div class="tt-transcript" data-tt-media-urls="https://www.nasa.gov/62284main_onesmall2.wav">
      <p>OK, I’m going to step off the LM now.</p>
      <p>That’s one small step for a man, one giant leap for mankind.</p>
    </div>
    
    <script src="../transcript-tracer.js"></script>
    <script>
      loadTranscriptTracer();
    </script>    
  </body>
</html>
```

## Demo examples

* [One Small Step](http://samuelbradshaw.github.io/transcript-tracer-js/examples/one-small-step.html) (this is the minimal example above)
* More examples coming soon


## Styling 

CSS styles can be applied to text at a block, phrase, or word level. For the purpose of styling with Transcript Tracer, a “block” usually corresponds to a section or paragraph. A “phrase” might be a sentence or a line in lyrics. A “word” is a sequence of characters separated by whitespace.

Transcript Tracer adds the following classes to elements in the HTML:

* **tt-word** – added to all words in the transcript.
* **tt-whitespace** – added to whitespace between words in the transcript.
* **tt-current-phrase** – added to all words in the current phrase.
* **tt-current-phrase-container** – added to the parent element for the current phrase (if there is one).
* **tt-current-block** – added to all words in the current block.
* **tt-current-block-container** – added to the parent element for the current block (if there is one).
* **tt-current-word** – added to the current word.
* **tt-previous-word** – added to all words preceeding the current word.

You can use the `blockSelector` and/or `phraseSelector` options when loading Transcript Tracer (see below) to control what elements Transcript Tracer should consider to be a block or phrase container.


## Options

When loading Transcript Tracer, you can pass in an options object for more control. The options object and all of its parameters are optional – anything that’s not specified will use default settings.

```
var ttOptions = {
  blockSelector: null,
  phraseSelector: null,
  alignmentFuzziness: 0,
  timeOffset: 0,
  autoScroll: null,
  clickable: false,
}
loadTranscriptTracer(ttOptions);
```

These are the available options:

* **blockSelector** – Selector for the HTML elements Transcript Tracer should use as block containers. If not specified, Transcript Tracer will attempt to find the first parent element that contains all of the text in the block. This is only used for styling (see above). Default: null. Supported values: Any valid [CSS selector string](https://developer.mozilla.org/en-US/docs/Web/API/Document_object_model/Locating_DOM_elements_using_selectors).

* **phraseSelector** – Selector for the HTML elements Transcript Tracer should use as phrase containers. If not specified, Transcript Tracer will attempt to find the first parent element that contains all of the text in the phrase. This is only used for styling (see above). Default: null. Supported values: Any valid [CSS selector string](https://developer.mozilla.org/en-US/docs/Web/API/Document_object_model/Locating_DOM_elements_using_selectors).

* **alignmentFuzziness** – Number of words Transcript Tracer is allowed to skip when attempting to align WebVTT to the transcript, in case there are words in the WebVTT that aren’t in the transcript. Default: 0. Supported values: Integer between 0 and 5.

* **timeOffset** – Number of seconds that should be added or removed when calculating timing for words being highlighted. This is useful if you want to highlight words sooner or later than they’re spoken, or if the WebVTT timestamps are slightly off. Default: 0. Supported values: Any number (including decimals) between 0 and 5.0.

* **autoScroll** – Whether the transcript should scroll to the next block, phrase, or word as it’s highlighted. Default: null. Supported values: null, 'block', 'phrase', or 'word'.

* **clickable** – Whether words in the transcript can be clicked (or tapped, on a touchscreen device). Clicking or tapping a word will advance the audio or video to that point. Default: false. Supported values: true or false.


## Troubleshooting

Things to check:
* One or more `<audio>` or `<video>` elements should be present on the page.
  * Each `<audio>` or `<video>` element should have a `src` attribute, or a `<source>` element with a `src` attribute, that points to a valid audio or video file.
  * Each `<audio>` or `<video>` element should have a `controls` attribute if you want the player controls to be visible on the page.
  * Each `<audio>` or `<video>` element should have a `preload=""` attribute set to `metadata` or `auto`.
* Each `<audio>` or `<video>` element for use with Transcript Tracer should have a child `<track>` element.
  * Each `<track>` element should have the attribute `kind="metadata"`.
  * Each `<track>` element should have the a `src` attribute that points to a valid WebVTT file.
    * If the WebVTT file is hosted on a different server, make sure CORS issues are resolved. You may also have CORS issues if you’re testing locally without running a local web server.
    * If preferred, you can put the WebVTT content inline with a data URL instead of using an external WebVTT file (see below).
* There should be a parent `<div>`, `<section>`, or other HTML element surrounding the transcript text on the page.
  * The element should have a class `tt-transcript`.
  * The element should have a `data-tt-media-urls=""` attribute that contains the URL(s) of the audio or video files on the page that are linked to the transcript.
  * If `data-tt-media-urls=""` has more than one URL, URLs should be separated with a semicolon (;).
* There should be a `<script>` element that references transcript-tracer.js.
  * Make sure a correct absolute or relative URL is being used to point to the file.
* There should be a second `<script>` element that calls the function `loadTranscriptTracer()`.
  * This second `<script>` element should be somewhere below the `<script>` element that references transcript-tracer.js (sequentially, transcript-tracer.js needs to be available before the function is called).
* There should be at least one valid CSS style rule to style the current word, phrase, or block (otherwise, classes will be added behind the scenes, but nothing will be visible to the user).


## FAQ

### What is WebVTT?

[WebVTT](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API) is a standard format for storing text that can be used as captions when playing media on a web page. Each line of text is associated with start and end timestamps.

### How can I create a WebVTT file?

Several tools exist for creating WebVTT files, with varying levels of granularity and accuracy. I created a tool called [Text to VTT](https://github.com/samuelbradshaw/text-to-vtt) that may be helpful for some use cases.

### Can I load WebVTT content without pointing to an external file?

If you store WebVTT content in a database with the transcript and other metadata, it may be more convenient to load WebVTT content inline instead of fetching a file from a server or making an API call. The HTML `<track>` element expects a URL to an external resource, but as a workaround, if you URL-encode your WebVTT content you can put it into a [data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs):

```
<audio preload="metadata" src="https://www.nasa.gov/62284main_onesmall2.wav" controls>
  <track kind="metadata" src="data:text/plain;charset=UTF-8,[your-url-encoded-webvtt-content]">
</audio>
```

### Can I load captions that are embedded in a video file?

Some videos have embedded subtitles in mov_text format. I haven’t yet found a way to extract mov_text subtitles on the fly with JavaScript; however, you may be able to extract them locally with a tool like [FFmpeg](https://ffmpeg.org), then convert them to WebVTT to include on the page.
