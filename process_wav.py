from pydub import AudioSegment
from pydub.playback import play

source_loc = "audio.wav"
cover_loc="audio/cover.mp3"
target_loc = "output.mp3"

source_audio = AudioSegment.from_wav(source_loc)
cover_audio = AudioSegment.from_mp3(cover_loc)

first_5_seconds = cover_audio[2000:10000]
last_5_seconds = cover_audio[5000:10000]
middle_5_seconds = source_audio[:10000]

beginning = first_5_seconds + 3
end = last_5_seconds - 3

first_half = beginning.append(middle_5_seconds, crossfade=4000)
whole_programme = first_half.append(end, crossfade=3000)

awesome = whole_programme.fade_in(2000).fade_out(3000)

awesome.export(target_loc, format="mp3")
final_audio = AudioSegment.from_mp3(target_loc)
play(final_audio)
