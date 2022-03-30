import { Component, OnInit } from '@angular/core';
import * as mm from '@magenta/music';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title='scherzo-bot'
  selectedView = 'generate'
  messagesList = ["...awaiting instruction to compose...", "...composing...", "music composed!", "training the models..."]
  message = this.messagesList[3]
  descriptionList = [
    "Generate - create short musical samples utilizing the MusicVAE model.",
    "Continue - compose a continuation to a given midi file input. This uses the MelodyRNN model.",
    "Interpolate - combine your midi musical ideas into a musical excerpt! This utilizes the MusicVAE model "
  ]
  description = this.descriptionList[0]
  player;
  musicRNN;
  steps = 60;
  temperature = 1;
  stepsPerQuarter = 4;
  musicVae: mm.MusicVAE;
  input0: mm.INoteSequence;
  input1: mm.INoteSequence;
  input2: mm.INoteSequence;
  generatedSong: mm.INoteSequence;
  playStop: string = 'Play';

  ngOnInit(): void {
    // const viz = new mm.PianoRollSVGVisualizer(JUMP_SONG, document.querySelector('svg'));
    const btn = document.getElementById('btn') as HTMLButtonElement;
    this.player = new mm.SoundFontPlayer(
      'https://storage.googleapis.com/magentadata/js/soundfonts/salamander',
      undefined, undefined, undefined,
      // {
      //   run: (note) => {
      //     viz.redraw(note, true);
      //   },
      //   stop: () => {
      //     btn.textContent = 'Play';
      //   }
      // });
    );
    this.musicRNN = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn');
    this.musicVae = new mm.MusicVAE("https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_med_q2")
    this.musicRNN.initialize();
    this.musicVae.initialize().then(a => this.message = this.messagesList[0]);
  }

  onClickTab(view: string, descriptionIndex: number): void {
    this.selectedView = view
    this.description = this.descriptionList[descriptionIndex]
    this.message = this.messagesList[0]
    this.generatedSong = undefined
  }

  onClickCompose(): void {
    this.message = this.messagesList[1]
    if (this.selectedView == 'generate') {
      this.musicVae.sample(1)
        .then(samples => {
          this.generatedSong = samples[0]
          this.message = this.messagesList[2]
        });
    } else if (this.selectedView == 'continue') {
      if (!this.input0) {
        this.message = 'No file inputed!'
        return;
      }
      const quantizedNotes = mm.sequences.quantizeNoteSequence(this.input0, this.stepsPerQuarter);
      this.musicRNN
        .continueSequence(quantizedNotes, this.steps, this.temperature)
        .then((sample) => {
          this.generatedSong = mm.sequences.concatenate([quantizedNotes, sample])
          this.message = this.messagesList[2]
        })
        .catch(err => console.log(err));
    } else {
      if (!this.input1 || !this.input2) {
        this.message = 'Not all files inputed!'
        return;
      }
      const quantizedNotes1 = mm.sequences.quantizeNoteSequence(this.input1, this.stepsPerQuarter);
      const quantizedNotes2 = mm.sequences.quantizeNoteSequence(this.input2, this.stepsPerQuarter);
      this.musicVae.interpolate([quantizedNotes1, quantizedNotes2], 4)
        .then(samples => {
          this.generatedSong = mm.sequences.concatenate(samples)
          this.message = this.messagesList[2]
        });

    }
  }

  playComposition(): void {
    if (this.player.isPlaying()) {
      this.player.stop();
      this.playStop = 'Play'
    } else {
      this.player.start(this.generatedSong);
      this.playStop = 'Stop'
    }
  }

  loadFile(file: any, input: number) {
    if (input == 0) {
      mm.blobToNoteSequence(file.item(0)).then(notes => this.input0 = notes)
    } else if (input == 1) {
      mm.blobToNoteSequence(file.item(0)).then(notes => this.input1 = notes)
    } else {
      mm.blobToNoteSequence(file.item(0)).then(notes => this.input2 = notes)
    }
  }

  download() {
    const sequence = JSON.parse(JSON.stringify(this.generatedSong));
    sequence.notes.forEach(n => n.velocity = this.steps);
    const data = mm.sequenceProtoToMidi(sequence)
    const filename = 'scherzo-bot-sample.mid'
    const type = 'audio/midi'
    const file = new Blob([data], {type: type});
    const a = document.createElement("a"),
              url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);  
    }, 0); 
  }

}