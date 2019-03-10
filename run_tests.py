import IPython

from pydub import AudioSegment
from pydub.playback import play


from scipy.io import wavfile
import noisereduce as nr
from noisereduce.generate_noise import band_limited_noise
import matplotlib.pyplot as plt

source_loc = "test_recording/jennifer-interview.mp3"
cover_loc="test_recording/cover.mp3"

source_audio = AudioSegment.from_mp3(source_loc)
cover_audio = AudioSegment.from_mp3(cover_loc)

# play(source_audio)

first_5_seconds = cover_audio[2000:10000]
last_5_seconds = cover_audio[5000:10000]
middle_5_seconds = source_audio[:10000]

beginning = first_5_seconds + 3
end = last_5_seconds - 3

first_half = beginning.append(middle_5_seconds, crossfade=4000)
whole_programme = first_half.append(end, crossfade=3000)git


awesome = whole_programme.fade_in(2000).fade_out(3000)
awesome.export("test_recording/podcast_source_audio.mp3", format="mp3")


target_loc = "test_recording/podcast_source_audio.mp3"
final_audio = AudioSegment.from_mp3(target_loc)
play(final_audio)

# noise_len = 2.
# noise = nr.generate_noise.band_limited_noise(min_freq=2000, max_freq=12000, samples=len(data), samplerate=rate)*10
# noise_clip = noise[:rate*noise_len]
# audio_clip_band_limited = data+noise

# print("noise added done")

# noise_reduced = nr.reduce_noise(audio_clip=audio_clip_band_limited, noise_clip=noise_clip, verbose=True)

# wavfile.write("/tmp/female-room-reduced.wav", rate, noise_reduced)
# print("finished processing")

# test_sound_enhanced = AudioSegment.from_Wav("/tmp/female-room-reduced.wav")
# play(test_sound_enhanced)

# IPython.display.Audio(data=data, rate=rate)

# fig, ax = plt.subplots(figsize=(20, 3))
# ax.plot(data)


